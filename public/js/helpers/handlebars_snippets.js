Handlebars.registerPartial("errorDiv",
    "<div class='errors'><ul>{{#each serverErrors}}<li>{{message}}</li>{{/each}}</ul></div>"
);

Handlebars.registerHelper("cache_buster", function() {
    return new Date().getTime();
});

Handlebars.registerHelper("ifAdmin", function(block) {
    if (chorus && chorus.user && chorus.user.get("admin")) {
        return block(this);
    } else {
        return block.inverse(this);
    }
});

Handlebars.registerHelper("ifAll", function() {
    // Handlebars actually passes in two functions: the first is block with block.inverse,
    // and the second function is just the block.inverse function itself.
    var args = _.toArray(arguments);
    var elseBlock = args.pop();
    var block = args.pop();
    if (args.length == 0) {
        throw "ifAll expects arguments";
    }
    if (_.all(args, _.identity)) {
        return block(this);
    } else {
        return elseBlock(this);
    }
});

Handlebars.registerHelper("ifAny", function() {
    var args = _.toArray(arguments);
    var elseBlock = args.pop();
    var block = args.pop();
    if (args.length == 0) {
        throw "ifAny expects arguments";
    }
    if (_.any(args)) {
        return block(this);
    } else {
        return elseBlock(this);
    }
});

Handlebars.registerHelper("currentUserName", function(block){
    return chorus.session.get("userName");
});

Handlebars.registerHelper("displayNameFromPerson", function(person) {
    return [person.firstName, person.lastName].join(' ')
})

Handlebars.registerHelper("displayTimestamp", function(timestamp) {
    return new Date(timestamp).toString("MMMM d")
})

Handlebars.registerHelper("moreLink", function(context) {
    if (context && context.length > 2) {
        return new Handlebars.SafeString("<a class='more'>" + t("activity_stream.comments.more", context.length - 2) + "</a>");
    } else {
        return "";
    }
})

Handlebars.registerHelper("eachWithMoreLink", function(context, max, fn, inverse) {
    var ret = "";

    if (context && context.length > 0) {
        for (var i = 0, j = Math.min(context.length, max); i < j; i++) {
            ret = ret + fn(context[i]);
            ret += Handlebars.helpers.moreLink(context);
        }
    } else {
        ret = inverse(this);
    }
    return ret;
})
