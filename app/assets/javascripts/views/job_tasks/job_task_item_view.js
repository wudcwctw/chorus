chorus.views.JobTaskItem = chorus.views.Base.extend({
    constructorName: "JobTaskItemView",
    templateName:"job_task_item",

    events: {
        "click .down_arrow": "moveJobTaskDown",
        "click .up_arrow"  : "moveJobTaskUp"
    },

    additionalContext: function () {
        var action = this.model.get("action");
        var collection = this.model.collection;
        return {
            checkable: false,
            url: this.model.showUrl(),
            actionKey: "job_task.action." + action,
            iconUrl: this.iconUrlForType(action),
            firstItem: collection.indexOf(this.model) === 0,
            lastItem: collection.indexOf(this.model) === collection.length - 1
        };
    },

    iconUrlForType: function (action) {
        var iconMap = {
            run_work_flow: "/images/jobs/afm-task.png",
            run_sql_file: "/images/workfiles/icon/sql.png",
            import_source_data: "/images/import_icon.png"
        };
        return iconMap[action];
    },

    moveJobTaskDown: function() { chorus.page.model.moveTaskDown(this.model); },
    moveJobTaskUp:   function() { chorus.page.model.moveTaskUp(this.model); }
});
