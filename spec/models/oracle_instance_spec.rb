require 'spec_helper'

describe OracleInstance do
  describe "validations" do
    let(:instance) { FactoryGirl.build(:oracle_instance) }

    it { should validate_presence_of(:host) }
    it { should validate_presence_of(:port) }

    context "when creating" do
      it "should validate owner account" do
        mock(instance).owner_account { mock(FactoryGirl.build(:instance_account)).valid? { true } }
        instance.valid?
      end
    end

    context "when host, port, or db_name change" do
      before do
        instance.save!(:validate => false)
        mock(instance).owner_account { mock(FactoryGirl.build(:instance_account)).valid? { true } }
      end

      it "validates the account when host changes" do
        instance.host = 'something_new'
        instance.valid?
      end
      it "validates the account when port changes" do
        instance.port = '5413'
        instance.valid?
      end
      it "validates the account when db_name changes" do
        instance.db_name = 'something_new'
        instance.valid?
      end
    end
  end

  describe "owner_account" do
    it "is created automatically" do
      instance = FactoryGirl.build(:oracle_instance, :owner_account => nil)
      stub(instance).valid_db_credentials?(anything) { true }
      instance.save!
      instance.owner_account.should_not be_nil
    end
  end
end