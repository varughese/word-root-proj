angular.module("wordRoots", ['ui.router'])

.config(['$stateProvider', '$urlRouterProvider', function ($stateProvider, $urlRouterProvider) {
    $urlRouterProvider
        .otherwise('/');

    $stateProvider
        .state('tiles', {
            url: '/',
            templateUrl: './tiles.html',
            controller: ['$scope', 'roots', 'rootsConfigurer', '$rootScope', TilesController]
        })
        .state('exs', {
            url: '/examples',
            templateUrl: './examples.html',
            controller: ['$scope', 'roots', 'rootsConfigurer', '$rootScope', ExamplesController]
        })
        .state('defs', {
            url: '/defintions',
            templateUrl: './defs.html',
            controller: ['$scope', 'roots', 'rootsConfigurer', '$rootScope', 'LocalStorage', DefintionsController]
        });
}])

.run(['$rootScope', 'roots', 'rootsConfigurer', function($rootScope, roots, rootsConfigurer) {
    $rootScope.ROOT_DEFS = {};
    $rootScope.DESIRED_DEFS = [];

    $rootScope.db = rootsConfigurer.getEXAMPLES();

    roots.kaplanRoots().success(function(data) {
        $rootScope.data =  data;
        rootsConfigurer.exampleLoader(data);
        rootsConfigurer.loadDefintions(data);
    });


    roots.examples().success(function(data) {
        for(var i in data) {
            var r = data[i].root;
            var exs = data[i].examples.split(",");
            rootsConfigurer.addExamples(r, exs);
        }
    });
}])

.controller('main', ['$scope', "$state", "$rootScope", 'roots', 'rootsConfigurer', '$q', 'LocalStorage', function($scope, $state, $rootScope, roots, rootsConfigurer, $q, LocalStorage) {
    $scope.isState = function(state) {
        return state === $state.current.name;
    };

    $scope.openDef = function(wr) {
        $scope.currentWr = wr.replace(/ /g, '').toUpperCase();
        $scope.currentDefintion = $rootScope.ROOT_DEFS[$scope.currentWr];
    };
    $scope.alphabetize = function() {
        $rootScope.DESIRED_DEFS.sort(function(a, b) {
            var textA = a.word.toUpperCase();
            var textB = b.word.toUpperCase();
            return (textA > textB) ? -1 : (textA < textB) ? 1 : 0;
        });
        $scope.save();
    };
    $scope.save = function() {
        var backup = LocalStorage.getObject("defs");
        LocalStorage.setObject("defs-BACKUP-" + LocalStorage.length, backup);
        LocalStorage.setObject("defs", $rootScope.DESIRED_DEFS);
    };
    $scope.fetch = function() {
        var counter = 0;
        function pushToDefs(res) {
            $rootScope.DESIRED_DEFS.push(res);
            counter++;
        }
        $rootScope.DESIRED_DEFS = [];
        var NUM_OF_ROOTS = 2;
        var filtered = rootsConfigurer.multiRootFinder($rootScope.db, NUM_OF_ROOTS);
        for(var i = 0; i<filtered.length; i++) {
            var root = filtered[i].root;
            var word = filtered[i].word;
            var otherRoots = filtered[i].roots;
            rootsConfigurer.addTerm(word, root, otherRoots).then(pushToDefs);
        }
    };
    $scope.clear = function() {
        LocalStorage.clear();
    };
}])

.service('rootsConfigurer', ['$rootScope', 'roots', '$q', function($rootScope, roots, $q) {
    var SELF = this;

    var EXAMPLES = {};

    var TERMS = [];

    var MISHAPS = {
        // Stores duplicates and non found
        repeats: [],
        homeless: [],
        testing: []
    };

    this.addTerm = function(word, rt, otherRoots) {
        var q = $q.defer();

        function Root(root, rootDef) {
            this.root = root;
            this.rootDef = $rootScope.ROOT_DEFS[root];
        }

        $q.all([roots.dictionary(word), roots.sentence(word)])
            .then(function(data) {
                var df = "", snt = "";
                df = data[0].data[0] ? data[0].data[0].text : "Defintion not found!";
                snt = data[1].data.examples ? data[1].data.examples[0].text : "Sentence not found!";
                var res = {
                    defintion: df,
                    word: word,
                    sentence: snt,
                    roots: []
                }, roots;
                if(otherRoots) {
                    roots = [rt].concat(otherRoots).map(function(r) {
                        return rootParser(r);
                    });
                } else {
                    roots = [rootParser(rt)];
                }

                for(var r in roots) {
                    res.roots.push(new Root(roots[r]));
                }
                q.resolve(res);
            })
            .catch(function(err) {
                q.reject("Error getting [" + word + "].");
            });

        return q.promise;
    };

    this.getExamples = function() {
        var result = [];
        for(var r in EXAMPLES) {
            result.push({root: r, examples: EXAMPLES[r]});
        }
        return result;
    };

    this.getEXAMPLES = function() {
        return EXAMPLES;
    };

    this.getMISHAPS = function() {
        return MISHAPS;
    };

    function rootParser(root) {
        var orgRoot;
        var fns =
        [
            function() {
                root = _.clean.root(root);
            },
            function() {
                orgRoot = root;
                var comma = root.indexOf(',');
                if(comma > -1) {
                    root = root.substring(0, comma);
                } else {
                    comma = -1000;
                }
            },
            function() {
                for(var key in EXAMPLES) {
                    var indexOfRoot = key.indexOf(root);
                    if(indexOfRoot === -1) continue;

                    indexOfRoot = key.split(",").indexOf(root);
                    if(indexOfRoot > -1) {
                        root = key;
                    }
                }
            },
            function() {
                for(var key in EXAMPLES) {
                    if(root.indexOf(key) > -1 && key.length - root.length === 1) {
                        root = key;
                    }
                }
            },
            function() {
                MISHAPS.homeless.push(orgRoot);
                root = false;
            }
        ];

        var o = 0;
        while(!EXAMPLES[root] && o<fns.length) {
            fns[o]();
            o++;
        }

        return root;
    }

    this.addExamples = function(root, examples, firstTime) {
        var r = (firstTime) ? root : rootParser(root);
        if(!r) return false;
        var current = EXAMPLES[r];
        if(current) {
            examples = _.perhapsArray(examples);
            for(var i in examples) {
                var ex = _.clean.example(examples[i]);
                if(!_.contains(current, ex)) {
                    EXAMPLES[r].push(ex);
                } else {
                    MISHAPS.repeats.push(root);
                }
            }
        } else {
            EXAMPLES[r] = _.perhapsArray(examples);
        }
    };

    this.exampleLoader = function(data) {
        /*
        * Data in EXAMPLES will look like this:
        * ```js
        * {
        *   "A,AN": ['ANARCHY', 'AN'],
        *   "BELLI,BELL": ['BELLIGERENT', 'ANTEBELLUM']
        *   "CAD,CAS,CID": ['CADENCE', 'CASCADE', 'ACCIDENT']
        * }
        * ```
        * Passing in 'CAD' to a certain getter function will return all the CAD,CAS,CID roots. TThe rootParser() function does so.
        *
        * The exampleLoader function will take in data, and add all of its examples to the examples array.
        * All validation (trimming, removing spaces) should be done here, and not in the parser!
        */
        for(var i in data) {
            var rootTerm = data[i];
            var root = _.clean.root(rootTerm.root);
            var examples = _.clean.example(rootTerm.examples.join(",")).split(",");

            SELF.addExamples(root, examples, true);
        }
    };

    var _ = {
        flattenArray: function(arr) {
            return arr.reduce(function(a,b) {
                return a.concat(b);
            }, []);
        },
        lengthSort: function(a, b) {
            return b.length - a.length;
        },
        replaceRoot: function(str, root, replace) {
            var result = false;

            if(root.indexOf("(2)") > -1)  {
                return str;
            }

            if(!str) {
                return 0;
            }

            function cryp(num) {
                var str = "";
                for(var i=0; i<num; i++) {
                    str+= replace || "-";
                }
                return str;
            }

            var roots = root.split(',');
            for(var r in roots) {
                var rt = roots[r];
                if(str.toLowerCase().indexOf(rt.toLowerCase()) > -1) {
                    var x = cryp(rt.length);
                    result = str.replace(rt.toLowerCase().trim(), x);
                    break;
                }
            }

            return result;
        },
        clean: {
            root: function(root) {
                return root.replace(/ /g, '').toUpperCase();
            },
            example: function(ex) {
                return ex.replace(/ /g, '').toLowerCase();
            }
        },
        contains: function(arr, str) {
            var res = false;
            str = str.trim().toLowerCase();
            for(var i in arr) {
                if(arr[i].toLowerCase().indexOf(str) > -1) return true;
            }
        },
        perhapsArray: function(mightBeAnArr) {
            return angular.isArray(mightBeAnArr) ? mightBeAnArr : [mightBeAnArr];
        },
        diffChecker: function(org, nw) {
            var diffs = 0;
            for(var i in org) {
                letter = org.charAt(i);
                nwLetter = nw.charAt(i);
                if(letter !== nwLetter) {
                    diffs++;
                }
            }

            // Prevemts word roots like A from counting if there is an A in the letter.
            if(diffs <= 2) {
                if(org.charAt(0) === nw.charAt(0)) diffs = 0;
            }

            return diffs;
        },
        filterEr: function(arr, key, value) {
            var res = [];
            for(var i in arr) {
                var current = arr[i];
                if(current[key] >= value) {
                    res.push(arr[i]);
                }
            }
            return res;
        }
    };

    this.loadDefintions = function(data) {
        for(var i in data) {
            $rootScope.ROOT_DEFS[_.clean.root(data[i].root)] = data[i].def;
        }
    };


    this.multiRootFinder = function(data, rootNum) {
        function Word(word, root) {
            this.root = root;
            this.roots = [];
            this.count = 0;
            this.word = word;
            this._word = _.replaceRoot(word, root, '!');
        }
        var words = [];
        var roots = [];

        for(var r in data) {
            var root = r;
            if(root.indexOf("(2)") < 0) {
                roots.push(r);
            }
            var examples = data[r];
            for(var i in examples) {
                words.push(new Word(examples[i], root));
            }
        }

        /** GLOBAL CHECKER VARIABLE **/
        var NUM_OF_ROOTS = rootNum || 2;

        roots = roots.sort(_.lengthSort);
        for(var w in words) {
            var count = 0;
            for(var rt=0; rt<roots.length; rt++) {
                var currentRoot = roots[rt],
                replacedWord = _.replaceRoot(words[w]._word, currentRoot);
                if(replacedWord && _.diffChecker(words[w]._word, replacedWord) > 0) {
                    words[w]._word = replacedWord;
                    words[w].roots.push(currentRoot);
                    count++;
                }
            }
            words[w].count = words[w].roots.length;
        }
        return _.filterEr(words, "count", NUM_OF_ROOTS-1);
    };

    this.quizletWebScraper = function(html) {
        // for use in the console on Quizlet website
        var roots = $(".terms .term .text .word .TermText").toArray();
        var qdef = $(".terms .term .text .definition .TermText").toArray();
        function Word(root, qdef) {
            this.root = root;
            this.def = qdef.substring(0, qdef.indexOf("(")-1);
            this.examples = qdef.substring(qdef.indexOf("(")+1, qdef.length-1).split(',');
        }
        var words = [];
        for(var i=0; i<roots.length; i++) {
            var root = $(roots[i]).text();
            var def = $(qdef[i]).text();
            words.push(new Word(root, def));
        }
    };
}])

.service('LocalStorage', function() {
    this.setObject = function(key, value) {
        localStorage.setItem(key, angular.toJson(value));
    };

    this.getObject = function(key) {
        var value = localStorage.getItem(key);
        return value && angular.fromJson(value);
    };

    this.clear = function() {
        localStorage.clear();
    };

    Object.defineProperty(this, "length", {
        get: function() {
            return localStorage.length;
        }
    });

})

.service('roots', ['$http', function($http) {
    var self = this;

    this.kaplanRoots = function() {
        return $http.get('roots.json');
    };

    this.quizletRoots = function() {
        return $http.get('quizlet.json');
    };

    this.examples = function() {
        return $http.get('examples.json');
    };

    this.convertData = function(dom) {
        var table = $('table', dom).last();
        var tds = table.find('td').toArray().map(function(str) {
            var root = $(str).find("a").text();
            str = $(str).text();
            return {root: root, examples: str.trim().slice(str.indexOf("Example :") + 3)};
        });
        console.log(JSON.stringify(tds));
    };

    this.wordRootsCom = function() {
        return $http.get('https://myvocabulary.com/dir-root-root_master');
    };

    this.dictionary = function(word) {
        return $http.get("http://api.wordnik.com:80/v4/word.json/" + word +"/definitions?limit=1&includeRelated=true&useCanonical=false&includeTags=false&api_key=a2a73e7b926c924fad7001ca3111acd55af2ffabf50eb4ae5");
    };
    this.sentence = function(word) {
        return $http.get("http://api.wordnik.com:80/v4/word.json/" + word + "/examples?includeDuplicates=false&useCanonical=false&skip=0&limit=1&api_key=a2a73e7b926c924fad7001ca3111acd55af2ffabf50eb4ae5");
    };

}])


.filter('Capitalize', function() {
  return function(input, scope) {
    if (input!==null)
        input = input.toLowerCase();
    return input.substring(0,1).toUpperCase()+input.substring(1);
  };
})

.filter('reverse', function() {
  return function(items) {
    return items.slice().reverse();
  };
})

;

function ExamplesController($scope, roots, rootsConfigurer, $rootScope) {
    roots.examples().success(function(data) {
        $scope.examples = data;
    });

    $scope.addExample = function() {
        rootsConfigurer.addExamples($scope.currentRoot, $scope.currentExamples);
    };

    $scope.holygrail = rootsConfigurer.getExamples();
}


function TilesController($scope, roots, rootsConfigurer, $rootScope) {
    $scope.loading=!$rootScope.data;


    roots.examples().success(function(data) {
        $scope.examples = data;
    });



    // $scope.openModal = function(root) {
    //     $scope.currentWordRootExample = '';
    //     $scope.currentWordRoot = root;
    //     $scope.examples.forEach(function(n) {
    //         if(root.indexOf(n.root) > -1)
    //             $scope.currentWordRootExample += n.examples.toUpperCase() + '\n';
    //     });
    //     $('#myModal').modal();
    // };
}

function DefintionsController($scope, roots, rootsConfigurer, $rootScope, LocalStorage) {
    $scope.rootFilter = function (item) {
        if(!$scope._wr) return true;
        return item.word.toLowerCase().indexOf($scope._wr.root.toLowerCase()) > -1;
    };

    $scope.bonus = function(item) {
        return $scope.filterOnBonus ? item.roots.length > 2 : true;
    };

    if(LocalStorage.getObject('defs')) {
        $rootScope.DESIRED_DEFS = LocalStorage.getObject('defs');
    } else {
        $scope.fetch();
    }

    $scope.addDef = function() {
        rootsConfigurer.addTerm($scope.ccurrentW, $scope.ccurrentWr, otherRoots).then(pushToDefs);
    };
    $scope.remove = function(word) {
        var i = $rootScope.DESIRED_DEFS.map(function(x) {return x.word; }).indexOf(word);
        $rootScope.DESIRED_DEFS.splice(i, 1);
    };
}
