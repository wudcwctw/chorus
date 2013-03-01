class DataSource < ActiveRecord::Base
  include SoftDelete

  attr_accessible :name, :description, :host, :port, :db_name, :db_username, :db_password, :as => [:default, :create]
  attr_accessible :shared, :as => :create

  belongs_to :owner, :class_name => 'User'
  has_many :accounts, :class_name => 'InstanceAccount', :inverse_of => :data_source, :foreign_key => "data_source_id", :dependent => :destroy
  has_one :owner_account, :class_name => 'InstanceAccount', :foreign_key => "data_source_id", :inverse_of => :data_source, :conditions => proc { {:owner_id => owner_id} }

  has_many :activities, :as => :entity
  has_many :events, :through => :activities

  validates_presence_of :name, :db_name
  validates_numericality_of :port, :only_integer => true, :if => :host?
  validates_length_of :name, :maximum => 64
  validates_with DataSourceNameValidator

  after_update :solr_reindex_later, :if => :shared_changed?

  after_create :enqueue_refresh
  after_create :create_data_source_created_event, :if => :current_user

  attr_accessor :highlighted_attributes, :search_result_notes
  searchable_model do
    text :name, :stored => true, :boost => SOLR_PRIMARY_FIELD_BOOST
    text :description, :stored => true, :boost => SOLR_SECONDARY_FIELD_BOOST
  end

  def self.by_type(entity_type)
    if entity_type == "gpdb_data_source"
      where(type: "GpdbDataSource")
    elsif entity_type == "oracle_data_source"
      where(type: "OracleDataSource")
    else
      self
    end
  end

  def self.reindex_data_source(id)
    data_source = find(id)
    data_source.solr_index
    data_source.datasets(:reload => true).each(&:solr_index)
  end

  def solr_reindex_later
    QC.enqueue_if_not_queued('DataSource.reindex_instance', id)
  end

  def self.unshared
    where("data_sources.shared = false OR data_sources.shared IS NULL")
  end

  def self.accessible_to(user)
    where('data_sources.shared OR data_sources.owner_id = :owned OR data_sources.id IN (:with_membership)',
          owned: user.id,
          with_membership: user.instance_accounts.pluck(:data_source_id)
    )
  end

  def accessible_to(user)
    DataSource.accessible_to(user).include?(self)
  end

  def self.refresh_databases data_source_id
    find(data_source_id).refresh_databases
  end

  def self.create_for_entity_type(entity_type, user, data_source_hash)
    entity_class = entity_type.classify.constantize rescue NameError
    raise ApiValidationError.new(:entity_type, :invalid) unless entity_class < DataSource
    entity_class.create_for_user(user, data_source_hash)
  end

  def valid_db_credentials?(account)
    success = true
    connection = connect_with(account).connect!
  rescue DataSourceConnection::Error => e
    raise unless e.error_type == :INVALID_PASSWORD
    success = false
  ensure
    connection.try(:disconnect)
    success
  end

  def connect_as_owner
    connect_with(owner_account)
  end

  def connect_as(user)
    connect_with(account_for_user!(user))
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

  def data_source
    self
  end

  def self.refresh(id, options={})
    symbolized_options = options.symbolize_keys
    symbolized_options[:new] = symbolized_options[:new].to_s == "true" if symbolized_options[:new]
    find(id).refresh symbolized_options
  end

  def refresh(options={})
    options[:skip_dataset_solr_index] = true if options[:new]
    refresh_databases options

    if options[:skip_dataset_solr_index]
      #The first refresh_all did not index the datasets in solr due to performance.
      refresh_schemas options.merge(:force_index => true)
    end
  end

  def refresh_databases_later
    QC.enqueue_if_not_queued('DataSource.refresh_databases', id)
  end

  def solr_reindex_later
    QC.enqueue_if_not_queued('DataSource.reindex_data_source', id)
  end

  private

  def enqueue_refresh
    QC.enqueue_if_not_queued("DataSource.refresh", self.id, 'new' => true)
  end

  def account_owned_by(user)
    accounts.find_by_owner_id(user.id)
  end

  def create_data_source_created_event
    Events::DataSourceCreated.by(current_user).add(:data_source => self)
  end
end