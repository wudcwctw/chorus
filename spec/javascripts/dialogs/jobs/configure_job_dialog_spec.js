describe("chorus.dialogs.ConfigureJob", function () {
    beforeEach(function () {
        this.jobPlan = {
            name: 'Apples',
            interval_value: '2',
            interval_unit: 'weeks',
            month: "7",
            day: "9",
            year: "3013",
            hour: '1',
            minute: '5',
            meridiem: 'am',
            time_zone: 'American Samoa'
        };

        this.workspace = backboneFixtures.workspace();

        spyOn(chorus.router, "navigate");

        this.dialog = new chorus.dialogs.ConfigureJob({workspace: this.workspace});
        spyOn(this.dialog.endDatePicker, "disable");
        this.dialog.render();
    });

    it("has all the dialog pieces", function () {
        expect(this.dialog.title()).toMatchTranslation("job.dialog.title");
        expect(this.dialog.$('button.submit').text()).toMatchTranslation("job.dialog.submit");
        expect(this.dialog.$('button.cancel').text()).toMatchTranslation("actions.cancel");
    });

    context("creating a Job that runs On Demand", function () {
        beforeEach(function () {
            this.jobPlan.interval_unit = 'on_demand';
        });

        it("leaves scheduling options hidden", function () {
            expect(this.dialog.$('.interval_options')).toHaveClass('hidden');
        });

        context("with valid field values", function () {
            beforeEach(function () {
                this.dialog.$('input.name').val(this.jobPlan.name).trigger("keyup");
            });

            it("should enable the submit button", function () {
                expect(this.dialog.$('button.submit')).toBeEnabled();
            });

            describe("submitting the form", function () {
                beforeEach(function () {
                    this.dialog.$("form").submit();
                });

                it("posts the form elements to the API", function () {
                    var postUrl = this.server.lastCreateFor(this.dialog.model).url;
                    expect(postUrl).toContain("/workspaces/" + this.workspace.id + "/jobs");
                });

                it("posts with the correct values", function() {
                    var params = this.server.lastCreate().params();
                    expect(params['job[name]']).toEqual(this.jobPlan.name);
                    expect(params['job[interval_unit]']).toEqual(this.jobPlan.interval_unit);
                    expect(params['job[interval_value]']).toEqual("0");
                });

                context("when the save fails", function () {
                    beforeEach(function () {
                        this.server.lastCreateFor(this.dialog.model).failUnprocessableEntity({
                            fields: {
                                BASE: { SOME_FAKE_ERROR: {}}
                            }
                        });
                    });

                    it("should display the errors for the model", function() {
                        expect(this.dialog.$(".errors li")).toExist();
                    });
                });

                context("when the save succeeds", function () {
                    beforeEach(function () {
                        spyOn(this.dialog, "closeModal");
                        spyOn(chorus, "toast");
                        this.server.lastCreate().succeed();
                    });

                    it("it should close the modal", function () {
                        expect(this.dialog.closeModal).toHaveBeenCalled();
                    });

                    it("should create a toast", function () {
                        expect(chorus.toast).toHaveBeenCalledWith(this.dialog.message());
                    });

                    it("should navigate to the job's show page", function () {
                        expect(chorus.router.navigate).toHaveBeenCalledWith(this.dialog.model.showUrl());
                    });
                });
            });
        });

        context("with invalid field values", function () {
            it("leaves the form disabled", function () {
                expect(this.dialog.$('button.submit')).toBeDisabled();
            });
        });
    });

    context("creating a Job that runs on schedule", function () {
        describe("selecting 'on schedule'", function () {
            beforeEach(function () {
                this.dialog.$('input:radio#onSchedule').prop("checked", true).trigger('change');
                this.dialog.$('input:radio#onDemand').prop("checked", false).trigger('change');
            });

            it("should show schedule options", function () {
                expect(this.dialog.$('.interval_options')).not.toHaveClass('hidden');
            });

            it("should have a select with hours, days, weeks, months as options", function() {
                expect(this.dialog.$(".interval_unit option[value=hours]")).toContainTranslation("job.interval_unit.hours");
                expect(this.dialog.$(".interval_unit option[value=days]")).toContainTranslation("job.interval_unit.days");
                expect(this.dialog.$(".interval_unit option[value=weeks]")).toContainTranslation("job.interval_unit.weeks");
                expect(this.dialog.$(".interval_unit option[value=months]")).toContainTranslation("job.interval_unit.months");
                expect(this.dialog.$(".interval_unit").val()).toBe("hours");
            });

            it("should show the start date controls", function() {
                expect(this.dialog.$(".start_date_widget")).toExist();
            });

            it("should show the end date controls", function () {
                expect(this.dialog.$(".end_date_widget")).toExist();
            });

            describe("selected time zone", function () {
                it("should be the first timezone that matches the browser's current offset according to jstz", function () {
                    chorus.models.Config.instance().set("timeZones", backboneFixtures.config().get('timeZones'));
                    spyOn(jstz, 'determine').andReturn({
                        name: function () {
                            return 'Asia/Kolkata';
                        }
                    });
                    this.dialog.render();
                    expect(this.dialog.$('select.time_zone').val()).toBe('Chennai');
                });
            });
        });

        context("with valid field values", function () {
            beforeEach(function () {
                this.dialog.$('input:radio#onSchedule').prop("checked", true).trigger("change");
                this.dialog.$('input:radio#onDemand').prop("checked", false).trigger("change");
                var dialog = this.dialog;
                var jobPlan = this.jobPlan;
                _.each(_.keys(this.jobPlan), function (prop) {
                    var selects = ['interval_unit', 'meridiem', 'hour', 'minute', 'time_zone'];
                    var element = (_.contains(selects, prop) ? 'select.' : 'input.');
                    dialog.$(element + prop).val(jobPlan[prop]).trigger("change").trigger("keyup");
                });
            });

            it("should enable the submit button", function () {
                expect(this.dialog.$('button.submit')).toBeEnabled();
            });

            context("with no end run", function () {
                it("should disable the end date widget", function () {
                    expect(this.dialog.endDatePicker.disable).toHaveBeenCalled();
                });

                describe("submitting the form", function () {
                    beforeEach(function () {
                        this.dialog.$("form").submit();
                    });

                    it("posts the form elements to the API", function () {
                        var postUrl = this.server.lastCreateFor(this.dialog.model).url;
                        expect(postUrl).toContain("/workspaces/" + this.workspace.id + "/jobs");
                    });

                    it("posts with the correct values", function() {
                        var params = this.server.lastCreate().params();
                        var date = moment.utc([this.jobPlan.year, parseInt(this.jobPlan.month, 10) - 1, this.jobPlan.day, parseInt(this.jobPlan.hour, 10), parseInt(this.jobPlan.minute, 10)]);
                        expect(params['job[name]']).toEqual(this.jobPlan.name);
                        expect(params['job[interval_unit]']).toEqual(this.jobPlan.interval_unit);
                        expect(params['job[interval_value]']).toEqual(this.jobPlan.interval_value);
                        expect(params['job[next_run]']).toEqual(date.format());
                        expect(params['job[end_run]']).not.toExist();
                    });

                    context("when the save succeeds", function () {
                        beforeEach(function () {
                            spyOn(this.dialog, "closeModal");
                            spyOn(chorus, "toast");
                            this.server.lastCreate().succeed();
                        });

                        it("it should close the modal", function () {
                            expect(this.dialog.closeModal).toHaveBeenCalled();
                        });

                        it("should create a toast", function () {
                            expect(chorus.toast).toHaveBeenCalledWith(this.dialog.message());
                        });

                        it("should navigate to the job's show page", function () {
                            expect(chorus.router.navigate).toHaveBeenCalledWith(this.dialog.model.showUrl());
                        });
                    });

                    context('when the save fails', function () {
                        beforeEach(function() {
                            spyOn(this.dialog, "closeModal");
                            this.server.lastCreate().fail();
                        });

                        it("does not close the dialog box", function() {
                            expect(this.dialog.closeModal).not.toHaveBeenCalled();
                        });

                        it("removes the spinner from the button", function() {
                            expect(this.dialog.$("button.submit").isLoading()).toBeFalsy();
                        });
                    });
                });
            });

            context("with an end run", function () {
                beforeEach(function () {
                    spyOn(this.dialog.endDatePicker, "enable");
                    this.dialog.$(".end_date_enabled").prop("checked", "checked").trigger("change");
                });

                it("should enable the end date widget", function () {
                    expect(this.dialog.endDatePicker.enable).toHaveBeenCalled();
                });

                describe("submitting the form", function () {
                    beforeEach(function () {
                        this.dialog.$("form").submit();
                    });

                    it("posts the form elements to the API", function () {
                        var postUrl = this.server.lastCreateFor(this.dialog.model).url;
                        expect(postUrl).toContain("/workspaces/" + this.workspace.id + "/jobs");
                    });

                    it("posts with the correct values", function() {
                        var params = this.server.lastCreate().params();
                        var date = moment.utc([this.jobPlan.year, parseInt(this.jobPlan.month, 10) - 1, this.jobPlan.day, parseInt(this.jobPlan.hour, 10), parseInt(this.jobPlan.minute, 10)]);
                        var endDate = moment(new Date(this.jobPlan.year, parseInt(this.jobPlan.month, 10) - 1, this.jobPlan.day));
                        expect(params['job[name]']).toEqual(this.jobPlan.name);
                        expect(params['job[interval_unit]']).toEqual(this.jobPlan.interval_unit);
                        expect(params['job[interval_value]']).toEqual(this.jobPlan.interval_value);
                        expect(params['job[next_run]']).toEqual(date.format());
                        expect(params['job[end_run]']).toEqual(endDate.toISOString());
                    });

                    context("when the save succeeds", function () {
                        beforeEach(function () {
                            spyOn(this.dialog, "closeModal");
                            spyOn(chorus, "toast");
                            this.server.lastCreate().succeed();
                        });

                        it("it should close the modal", function () {
                            expect(this.dialog.closeModal).toHaveBeenCalled();
                        });

                        it("should create a toast", function () {
                            expect(chorus.toast).toHaveBeenCalledWith(this.dialog.message());
                        });

                        it("should navigate to the job's show page", function () {
                            expect(chorus.router.navigate).toHaveBeenCalledWith(this.dialog.model.showUrl());
                        });
                    });
                });
            });
        });

        context("with invalid field values", function () {
            beforeEach(function () {
                this.dialog.$('input.interval_value').val('').trigger("keyup");
            });

            it("leaves the form disabled", function () {
                expect(this.dialog.$('button.submit')).toBeDisabled();
            });
        });
    });

    context("when constructed with an old Job", function () {
        beforeEach(function () {
            this.job = backboneFixtures.job();
            this.workspace = this.job.get("workspace");

            chorus.models.Config.instance().set("timeZones", [
                ['Other Time Zone', 'Pacific'],
                ['American Samoa is Fun!', 'American Samoa']
            ]);

            this.dialog = new chorus.dialogs.ConfigureJob({model: this.job});
            spyOn(this.dialog.endDatePicker, "enable");
            this.dialog.render();
        });

        describe("prepopulating the dialog with the job's attributes", function () {
        it("populates name", function () {
            expect(this.dialog.$("input.name").val()).toBe(this.job.get("name"));
        });

        it("populates intervalValue and itnervalUnit", function () {
            expect(this.dialog.$("input.interval_value").val()).toBe(this.job.get("intervalValue").toString());
            expect(this.dialog.$("select.interval_unit").val()).toBe(this.job.get("intervalUnit"));
        });

        it("populates next run date", function () {
            var nextRunDate = this.job.nextRunDate().startOf("minute");
            nextRunDate.minute(nextRunDate.minute());
            expect(this.dialog.buildStartDate().format("YYYY-MM-DDTHH:mm")).toEqual(nextRunDate.format("YYYY-MM-DDTHH:mm"));
        });

        it("populates end date", function () {
            var endRunDate = this.job.endRunDate().startOf("day");

            expect(this.dialog.buildEndDate().format("YYYY-MM-DD")).toEqual(endRunDate.format("YYYY-MM-DD"));
        });

        it("populates time zone", function () {
            this.job.set("nextRun", "2013-07-29T08:00:00-11:00");
            this.job.set("timeZone", "American Samoa");
            this.dialog.render();
            expect(this.dialog.$('select.time_zone').val()).toEqual("American Samoa");
        });

    });

        context("editing a Job that runs on schedule with an end run time", function () {
        describe("selecting 'on schedule'", function () {

            it("should show schedule options", function () {
                expect(this.dialog.$('.interval_options')).not.toHaveClass('hidden');
            });

            it("should have a select with hours, days, weeks, months as options", function () {
                expect(this.dialog.$(".interval_unit option[value=hours]")).toContainTranslation("job.interval_unit.hours");
                expect(this.dialog.$(".interval_unit option[value=days]")).toContainTranslation("job.interval_unit.days");
                expect(this.dialog.$(".interval_unit option[value=weeks]")).toContainTranslation("job.interval_unit.weeks");
                expect(this.dialog.$(".interval_unit option[value=months]")).toContainTranslation("job.interval_unit.months");
            });

            it("should show the start date controls", function () {
                expect(this.dialog.$(".start_date_widget")).toExist();
            });

            it("should show the end date controls", function () {
                expect(this.dialog.$(".end_date_widget")).toExist();
            });
        });

        context("with valid field values", function () {
            beforeEach(function () {
                this.dialog.$('input:radio#onSchedule').prop("checked", true).trigger("change");
                this.dialog.$('input:radio#onDemand').prop("checked", false).trigger("change");
                var dialog = this.dialog;
                var jobPlan = this.jobPlan;
                _.each(_.keys(this.jobPlan), function (prop) {
                    var selects = ['interval_unit', 'meridiem', 'hour', 'minute', 'time_zone'];
                    var element = (_.contains(selects, prop) ? 'select.' : 'input.');
                    dialog.$(element + prop).val(jobPlan[prop]).trigger("change").trigger("keyup");
                });
            });

            it("should enable the submit button", function () {
                expect(this.dialog.$('button.submit')).toBeEnabled();
            });

            it("should enable the end date widget", function () {
                expect(this.dialog.endDatePicker.enable).toHaveBeenCalled();
            });

            describe("submitting the form", function () {
                beforeEach(function () {
                    this.dialog.$("form").submit();
                });

                it("posts the form elements to the API", function () {
                    var postUrl = this.server.lastUpdateFor(this.dialog.model).url;
                    expect(postUrl).toContain("/workspaces/" + this.workspace.id + "/jobs/" + this.job.id);
                });

                it("posts with the correct values", function () {
                    var params = this.server.lastUpdate().params();
                    var date = moment.utc([this.jobPlan.year, parseInt(this.jobPlan.month, 10) - 1, this.jobPlan.day, parseInt(this.jobPlan.hour, 10), parseInt(this.jobPlan.minute, 10)]);
                    var endDate = moment(new Date(this.jobPlan.year, parseInt(this.jobPlan.month, 10) - 1, this.jobPlan.day));
                    expect(params['job[name]']).toEqual(this.jobPlan.name);
                    expect(params['job[interval_unit]']).toEqual(this.jobPlan.interval_unit);
                    expect(params['job[interval_value]']).toEqual(this.jobPlan.interval_value);
                    expect(params['job[next_run]']).toEqual(date.format());
                    expect(params['job[end_run]']).toEqual(endDate.toISOString());
                    expect(params['job[time_zone]']).toEqual(this.jobPlan.time_zone);
                });

                context("when the save succeeds", function () {
                    beforeEach(function () {
                        spyOn(this.dialog, "closeModal");
                        spyOn(chorus, "toast");
                        this.server.lastUpdate().succeed();
                    });

                    it("it should close the modal", function () {
                        expect(this.dialog.closeModal).toHaveBeenCalled();
                    });

                    it("should create a toast", function () {
                        expect(chorus.toast).toHaveBeenCalledWith(this.dialog.message());
                    });
                });
            });
        });

        context("with invalid field values", function () {
            beforeEach(function () {
                this.dialog.$('input.interval_value').val('').trigger("keyup");
            });

            it("leaves the form disabled", function () {
                expect(this.dialog.$('button.submit')).toBeDisabled();
            });
        });

        context("when switching it to onDemand", function () {
            beforeEach(function () {
                this.dialog.$('input:radio#onSchedule').prop("checked", false).trigger("change");
                this.dialog.$('input:radio#onDemand').prop("checked", true).trigger("change");
            });

            it("should enable the submit button", function () {
                expect(this.dialog.$('button.submit')).toBeEnabled();
            });

            it("should hide the interval options", function () {
                expect(this.dialog.$(".interval_options")).toHaveClass("hidden");
            });

            describe("submitting the form", function () {
                beforeEach(function () {
                    this.dialog.$("form").submit();
                });

                it("posts the form elements to the API", function () {
                    var postUrl = this.server.lastUpdateFor(this.dialog.model).url;
                    expect(postUrl).toContain("/workspaces/" + this.workspace.id + "/jobs/" + this.job.id);
                });

                it("posts with the correct values", function () {
                    var params = this.server.lastUpdate().params();
                    expect(params['job[name]']).toEqual(this.job.get("name"));
                    expect(params['job[interval_unit]']).toEqual("on_demand");
                    expect(params['job[interval_value]']).toEqual("0");
                    expect(params['job[next_run]']).toBe("invalid");
                    expect(params['job[end_run]']).toBe("invalid");
                });

                context("when the save succeeds", function () {
                    beforeEach(function () {
                        spyOn(this.dialog, "closeModal");
                        spyOn(chorus, "toast");
                        this.server.lastUpdate().succeed();
                    });

                    it("it should close the modal", function () {
                        expect(this.dialog.closeModal).toHaveBeenCalled();
                    });

                    it("should create a toast", function () {
                        expect(chorus.toast).toHaveBeenCalledWith(this.dialog.message());
                    });
                });
            });
        });
    });
    });
});