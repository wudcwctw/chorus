describe("chorus.pages.SearchIndexPage", function() {
    beforeEach(function() {
        this.query = "foo";
        this.model = new chorus.models.SearchResult({ query: this.query });
        this.page = new chorus.pages.SearchIndexPage("all", this.query);
    });

    it("fetches the search results for the given query", function() {
        expect(this.model).toHaveBeenFetched();
    });

    describe("when the search result fetch completes", function() {
        beforeEach(function() {
            this.model = fixtures.searchResult({ query: "foo" });
            this.server.completeFetchFor(this.model);
        });

        it("has breadcrumbs", function() {
            expect(this.page.$(".breadcrumbs li:eq(0)")).toContainTranslation('breadcrumbs.home');
            expect((this.page.$(".breadcrumbs li:eq(0) a")).attr("href")).toBe("#/");

            expect(this.page.$(".breadcrumbs li:eq(1) .slug")).toContainTranslation('breadcrumbs.search_results');
        });

        it("has the right title", function() {
            expect(this.page.$(".default_content_header h1")).toContainTranslation("search.index.title", {query: this.query});
        });

        it("has a 'Show All Results' link", function() {
            expect(this.page.$('.default_content_header .title')).toContainTranslation("search.show")
            expect(this.page.$('.default_content_header a')).toContainTranslation("search.type.all")
            expect(this.page.$('.default_content_header a')).toContainTranslation("search.type.workfile")
            expect(this.page.$('.default_content_header a')).toContainTranslation("search.type.hadoop")
            expect(this.page.$('.default_content_header a')).toContainTranslation("search.type.dataset")
            expect(this.page.$('.default_content_header a')).toContainTranslation("search.type.workspace")
            expect(this.page.$('.default_content_header a')).toContainTranslation("search.type.user")
        });

        describe("filtering by result type", function() {
            beforeEach(function() {
                spyOn(chorus.router, "navigate");
                this.page.$('.default_content_header li[data-type="workspace"] a').click();
            });

            it("should navigate to the filtered result type page", function() {
                expect(chorus.router.navigate).toHaveBeenCalledWith('#/search/workspace/foo', true);
            });
        });

        context("when searching for a workspace", function() {
            beforeEach(function() {
                this.query = "Foo";
                this.model = fixtures.searchResult({ query: this.query });
                this.page = new chorus.pages.SearchIndexPage("workspace", this.query);
                this.server.completeFetchFor(this.model);
            });

            it("selects the search result type in the menu", function() {
                expect(this.page.$(".default_content_header .chosen")).toContainTranslation("search.type.workspace");
            });
        });

        describe("the workfile section", function() {
            beforeEach(function() {
                this.workfileLIs = this.page.$(".workfile_list li");
            });

            it("shows a list of search results", function() {
                expect(this.workfileLIs.length).toBeGreaterThan(0);
            });

            it("selects the first workfile by default", function() {
                expect(this.workfileLIs.eq(0)).toHaveClass("selected");
            });

            describe("clicking on a workfile search result", function() {
                beforeEach(function() {
                    this.workfileLIs.eq(1).trigger("click");
                });

                it("selects that workfile", function() {
                    expect(this.workfileLIs.eq(1)).toHaveClass("selected");
                });

                it("shows that workfile in the sidebar", function() {
                    expect(this.page.sidebar.$(".fileName")).toHaveText("test.sql");
                });

                it("does not show the 'add a note' link in the sidebar", function() {
                    expect(this.page.sidebar.$("a[data-dialog='NotesNew']")).not.toExist()
                })
            });
        });

        describe("the workspace section", function() {
            beforeEach(function() {
                this.workspaceLIs = this.page.$(".workspace_list li");
            });

            it("shows a list of search results", function() {
                expect(this.workspaceLIs.length).toBeGreaterThan(0);
            });

            describe("clicking on a workspace search result", function() {
                beforeEach(function() {
                    this.workspaceLIs.eq(1).trigger("click");
                });

                it("selects that workspace", function() {
                    expect(this.workspaceLIs.eq(1)).toHaveClass("selected");
                });

                it("shows that workspace in the sidebar", function() {
                    expect(this.page.sidebar.$(".info .name")).toHaveText("other_ws");
                });

                it("show the 'add a note' link in the sidebar", function() {
                    expect(this.page.sidebar.$("a[data-dialog='NotesNew']")).toExist()
                })

                it("show the 'add an insight' link in the sidebar", function() {
                    expect(this.page.sidebar.$("a[data-dialog='InsightsNew']")).toExist()
                })
            });
        });

        describe("the dataset section", function() {
            beforeEach(function() {
                this.datasetLIs = this.page.$(".dataset_list li");
            });

            it("shows a list of search results", function() {
                expect(this.datasetLIs.length).toBeGreaterThan(0);
            });

            describe("clicking on a tabular data search result", function() {
                beforeEach(function() {
                    this.datasetLIs.eq(2).trigger("click");
                });

                it("selects that tabular data item", function() {
                    expect(this.datasetLIs.eq(2)).toHaveClass("selected");
                });

                it("shows the tabular data item in the sidebar", function() {
                    expect(this.page.sidebar.$(".info .name")).toHaveText("test1");
                });

                it("shows the associate-with-workspace link in the sidebar", function() {
                    expect(this.page.sidebar.$('a.associate')).toExist();
                });
            });
        });

        describe("the user section", function() {
            beforeEach(function() {
                this.users = this.model.users();
                this.userLis = this.page.$(".user_list li");
            });

            it("shows a list of search results", function() {
                expect(this.userLis.length).toBeGreaterThan(0);
            });

            describe("clicking on a user search result", function() {
                beforeEach(function() {
                    this.clickedUser = this.users.at(1);
                    this.userLis.eq(1).trigger("click");
                });

                it("selects that user", function() {
                    expect(this.userLis.eq(1)).toHaveClass("selected");
                });

                it("fetches the user's activities'", function() {
                    expect(this.clickedUser.activities()).toHaveBeenFetched();
                });

                describe("when all of the sidebar's fetches complete", function() {
                    beforeEach(function() {
                        this.server.completeFetchFor(this.clickedUser.activities(), []);
                        this.server.completeFetchFor(chorus.models.Config.instance());
                    });

                    it("shows that user in the sidebar", function() {
                        expect(this.page.sidebar.$(".info .full_name")).toHaveText(this.users.at(1).displayName());
                    });
                });
            });
        });
    });
});
