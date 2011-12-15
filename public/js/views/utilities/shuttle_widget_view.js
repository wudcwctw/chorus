;(function($, ns) {
    ns.views.ShuttleWidget = ns.views.Base.extend({
        className : "shuttle_widget",

        events : {
            "click a.add" : "toggleAdd",
            "click a.remove" : "toggleAdd",
            "click a.add_all" : "addAll",
            "click a.remove_all" : "removeAll"
        },

        setup : function() {
            this.selectionSource = this.options.selectionSource;
            this.selectionSource.bind("reset", this.render);
            this.nonRemovableModels = this.options.nonRemovable;
        },

        collectionModelContext : function(model) {
            var ctx = {};
            var selections = this.selectionSource.map(function(item) { return item.get("id")});
            ctx.isAdded = _.include(selections, model.get("id"));
            ctx.displayName = model.displayName();
            ctx.imageUrl = model.imageUrl();

            ctx.isNonRemovable = _.include(this.nonRemovableModels, model);
            ctx.nonRemovableText = this.options.nonRemovableText;

            return ctx;
        },

        additionalContext : function() {
            return { objectName: this.options.objectName };
        },

        postRender : function() {
            this._updateLabels();
            this.$("input").unbind("textchange").bind("textchange", _.bind(this.searchItems, this));
        },

        toggleAdd : function(e) {
            e.preventDefault();

            var target = this.$(e.currentTarget);
            var id = target.closest("li").data("id");
            var isAdding = target.closest("ul").hasClass("available");

            this.$("li[data-id='" + id + "']").toggleClass("added", isAdding);

            this._updateLabels();
        },

        getSelectedIDs : function() {
            var selectedItems = this.$('ul.selected li.added');
            return _.map(selectedItems, function(item) {
                return $(item).data("id").toString();
            });
        },

        addAll : function(e) {
            e.preventDefault();
            this.$("li").addClass("added");
            this._updateLabels();
        },

        removeAll : function(e) {
            e.preventDefault();

            this.$("li").removeClass("added");
            this._updateLabels();
        },

        searchItems : function(e) {
            var compare = this.$("input").val().toLowerCase();
            this.$("ul.available li").each(function() {
                var matches = ($(this).find(".name").text().toLowerCase().indexOf(compare) >= 0);
                $(this).toggleClass("filtered_out", !matches);
            });
        },

        _updateLabels : function() {
            this.$(".selected_count").text(this.$("ul.selected li.added").length);
        }
    })
})(jQuery, chorus);
