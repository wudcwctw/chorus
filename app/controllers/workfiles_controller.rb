require 'will_paginate/array'

class WorkfilesController < ApplicationController
  def show
    workfile = Workfile.find(params[:id])
    authorize! :show, workfile.workspace
    present workfile.last_version
  end

  def create
    workspace = Workspace.find(params[:workspace_id])
    authorize! :can_edit_sub_objects, workspace

    present create_workfile(workspace, workfile_attributes).last_version
  end

  def index
    workspace = Workspace.find(params[:workspace_id])
    authorize! :show, workspace

    workfiles = workspace.workfiles.order(workfile_sort(params[:order]))
    workfiles = workfiles.by_type(params[:file_type]) if params.has_key?(:file_type)

    workfile_versions = workfiles.map(&:last_version)

    present paginate(workfile_versions)
  end

  def destroy
    workfile = Workfile.find(params[:id])
    authorize! :can_edit_sub_objects,  workfile.workspace

    workfile.destroy
    render :json => {}
  end

  private

  def workfile_sort(column_name)
    if column_name.blank? || column_name == "file_name"
      "lower(file_name)"
    else
      "updated_at"
    end
  end

  def workfile_attributes
    if params[:workfile][:source] == "empty"
      new_params = params[:workfile].dup
      new_params[:versions_attributes] = [{
          :contents => create_sql_file(params[:workfile][:file_name])
      }]

      new_params
    else
      params[:workfile]
    end
  end

  def create_sql_file(filename)
    ActionDispatch::Http::UploadedFile.new(:filename => filename, :tempfile => Tempfile.new(filename))
  end

  def create_workfile(workspace, attributes)
    workfile = Workfile.create_from_file_upload(attributes, workspace, current_user)

    Events::WORKFILE_CREATED.by(current_user).add(
      :workfile => workfile,
      :workspace => workspace
    )

    workspace.has_added_workfile = true
    workspace.save!

    workfile
  end
end
