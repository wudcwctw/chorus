require 'spec_helper'

describe JobResultsController do
  before do
    log_in users(:owner)

  end
  let(:job) { jobs(:default) }

  describe '#show' do
    context "when requesting only the latest result" do
      let(:params) { {:job_id => job.id, :id => 'latest'} }

      it "presents the most recent job result" do
        get :show, params
        decoded_response[:id].should == job.job_results.last.id
        decoded_response[:finished_at].should_not be_nil
      end

      generate_fixture "jobResult.json" do
        get :show, params
      end
    end
  end
end