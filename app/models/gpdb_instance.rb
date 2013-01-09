class GpdbInstance < DataSource
  attr_accessible :name, :description, :host, :port, :maintenance_db, :state,
                  :provision_type, :description, :instance_provider, :version

  validates_presence_of :name, :maintenance_db
  validates_numericality_of :port, :only_integer => true, :if => :host?
  validates_length_of :name, :maximum => 64

  validates_with DataSourceNameValidator

  has_many :activities, :as => :entity
  has_many :events, :through => :activities
  belongs_to :owner, :class_name => 'User'
  has_many :accounts, :class_name => 'InstanceAccount', :inverse_of => :instance, :foreign_key => "instance_id"
  has_many :databases, :class_name => 'GpdbDatabase', :dependent => :destroy
  has_many :schemas, :through => :databases, :class_name => 'GpdbSchema'
  has_many :datasets, :through => :schemas
  has_many :workspaces, :through => :schemas, :foreign_key => 'sandbox_id'
  after_update :solr_reindex_later, :if => :shared_changed?

  has_many :events_where_target1, :class_name => "Events::Base", :as => :target1, :dependent => :destroy

  attr_accessor :highlighted_attributes, :search_result_notes
  searchable do
    text :name, :stored => true, :boost => SOLR_PRIMARY_FIELD_BOOST
    text :description, :stored => true, :boost => SOLR_SECONDARY_FIELD_BOOST
    string :grouping_id
    string :type_name
    string :security_type_name, :multiple => true
  end

  def self.unshared
    where("data_sources.shared = false OR data_sources.shared IS NULL")
  end

  def self.reindex_instance instance_id
    instance = GpdbInstance.find(instance_id)
    instance.solr_index
    instance.datasets(:reload => true).each(&:solr_index)
  end

  def self.refresh_databases instance_id
    GpdbInstance.find(instance_id).refresh_databases
  end

  def solr_reindex_later
    QC.enqueue_if_not_queued('GpdbInstance.reindex_instance', id)
  end

  def refresh_databases_later
    QC.enqueue_if_not_queued('GpdbInstance.refresh_databases', id)
  end

  def self.owned_by(user)
    if user.admin?
      scoped
    else
      where(:owner_id => user.id)
    end
  end

  def used_by_workspaces(viewing_user)
    workspaces.workspaces_for(viewing_user).order("lower(workspaces.name)")
  end

  def self.accessible_to(user)
    where('data_sources.shared OR data_sources.owner_id = :owned OR data_sources.id IN (:with_membership)',
          :owned => user.id,
          :with_membership => user.instance_accounts.pluck(:instance_id)
    )
  end

  def accessible_to(user)
    GpdbInstance.accessible_to(user).include?(self)
  end

  def connect_with(account)
    GreenplumConnection::InstanceConnection.new(
        :username => account.db_username,
        :password => account.db_password,
        :host => host,
        :port => port,
        :database => maintenance_db,
        :logger => Rails.logger
    )
  end

  def refresh_databases(options ={})
    found_databases = []
    rows = Gpdb::ConnectionBuilder.connect!(self, owner_account, maintenance_db) { |conn| conn.select_all(database_and_role_sql) }
    database_account_groups = rows.inject({}) do |groups, row|
      groups[row["database_name"]] ||= []
      groups[row["database_name"]] << row["db_username"]
      groups
    end

    database_account_groups.each do |database_name, db_usernames|
      database = databases.find_or_initialize_by_name(database_name)

      # TODO: [#40454327] Don't just skip refreshing the database. Actually do something useful.
      if database.invalid?
        databases.delete(database)
        next
      end

      database.update_attributes!({:stale_at => nil}, :without_protection => true)
      database_accounts = accounts.where(:db_username => db_usernames)
      if database.instance_accounts.sort != database_accounts.sort
        database.instance_accounts = database_accounts
        QC.enqueue_if_not_queued("GpdbDatabase.reindex_dataset_permissions", database.id) if database.datasets.count > 0
      end
      found_databases << database
    end
  rescue ActiveRecord::JDBCError => e
    Chorus.log_error "Could not refresh database: #{e.message} on #{e.backtrace[0]}"
  ensure
    if options[:mark_stale]
      (databases.not_stale - found_databases).each do |database|
        database.mark_stale!
      end
    end
  end

  def create_database(name, current_user)
    new_db = databases.build(:name => name)
    raise ActiveRecord::RecordInvalid.new(new_db) unless new_db.valid?

    create_database_in_instance(name, current_user)
    refresh_databases
    databases.find_by_name!(name)
  end

  def account_names
    accounts.pluck(:db_username)
  end

  def owner_account
    account_owned_by(owner)
  end

  def account_for_user(user)
    if shared?
      owner_account
    else
      account_owned_by(user)
    end
  end

  def account_for_user!(user)
    account_for_user(user) || (raise ActiveRecord::RecordNotFound.new)
  end

  def gpdb_instance
    self
  end

  def self.refresh(id, options={})
    symbolized_options = options.symbolize_keys
    symbolized_options[:new] = symbolized_options[:new].to_s == "true" if symbolized_options[:new]
    find(id).refresh symbolized_options
  end

  def refresh(options={})
    refresh_databases options
    refresh_all options

    # would do this in a separate job, but QC doesn't seem to guarantee the order and development only uses one worker
    if options[:new]
      refresh_all options.except(:new).merge(:force_index => true)
    end
  end

  def refresh_all(options={})
    databases.each do |database|
      begin
        GpdbSchema.refresh(owner_account, database, options.reverse_merge(:refresh_all => true))
      rescue GreenplumConnection::InstanceUnreachable => e
        Chorus.log_error "Could not refresh database #{database.name}: #{e.message} #{e.backtrace.to_s}"
      end
    end
  end

  def entity_type_name
    'gpdb_instance'
  end

  def self.type_name
    'Instance'
  end

  private

  def create_database_in_instance(name, current_user)
    Gpdb::ConnectionBuilder.connect!(self, account_for_user!(current_user)) do |conn|
      sql = "CREATE DATABASE #{conn.quote_column_name(name)}"
      conn.exec_query(sql)
    end
  end

  def database_and_role_sql
    roles = Arel::Table.new("pg_catalog.pg_roles", :as => "r")
    databases = Arel::Table.new("pg_catalog.pg_database", :as => "d")

    roles.join(databases).
        on(Arel.sql("has_database_privilege(r.oid, d.oid, 'CONNECT')")).
        where(
        databases[:datname].not_eq("postgres").
            and(databases[:datistemplate].eq(false)).
            and(databases[:datallowconn].eq(true)).
            and(roles[:rolname].in(account_names))
    ).project(
        roles[:rolname].as("db_username"),
        databases[:datname].as("database_name")
    ).to_sql
  end

  def account_owned_by(user)
    accounts.find_by_owner_id(user.id)
  end
end
