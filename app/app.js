angular.module("wordRoots", ['ui.router'])

.config(['$stateProvider', function ($stateProvider) {
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
            controller: ['$scope', 'roots', 'rootsConfigurer', '$rootScope', DefintionsController]
        });
}])

.run(['$rootScope', 'roots', 'rootsConfigurer', function($rootScope, roots, rootsConfigurer) {
    $rootScope.ROOT_DEFS = {};
    $rootScope.DESIRED_DEFS = [];

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

.controller('main', ['$scope', "$state", "$rootScope", 'roots', 'rootsConfigurer', '$q', function($scope, $state, $rootScope, roots, rootsConfigurer, $q) {
    $scope.isState = function(state) {
        return state === $state.current.name;
    };

    $scope.openDef = function(wr) {
        $scope.currentWr = wr.replace(/ /g, '').toUpperCase();
        $scope.currentDefintion = $rootScope.ROOT_DEFS[$scope.currentWr];
        $rootScope.db = rootsConfigurer.getEXAMPLES();
        $rootScope.db[$scope.currentWr].map(function(w) {
            $q.all([roots.dictionary(w), roots.sentence(w)])
                .then(function(data) {
                    var df = "", snt = "";
                    df = data[0].data[0] ? data[0].data[0].text : "Defintion not found!";
                    snt = data[1].data ? data[1].data.examples[0].text : "Sentence not found!";
                    $rootScope.DESIRED_DEFS.push({word: w, defintion: df, sentence: snt, rt: wr, rtDef: $scope.currentDefintion});
                })
                .catch(function(err) {
                    console.error("Error getting [" + w + "].");
                });
        });
    };
}])

.service('rootsConfigurer', ['$rootScope', function($rootScope) {
    var SELF = this;

    var EXAMPLES = {};

    var DEFINTIONS = {};

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

    var MISHAPS = {
        repeats: [],
        homeless: []
    }; // Stores duplicates and non found

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
            var x = new Array(root.length).join(replace || "-");
            return str.replace(root.toLowerCase().trim(), x);
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
        }
    };

    this.loadDefintions = function(data) {
        for(var i in data) {
            $rootScope.ROOT_DEFS[_.clean.root(data[i].root)] = data[i].def;
        }
    };

    // this.exampleList = function(data) {
    //     var roots = [];
    //     var examples = [];
    //
    //     function Word(word, root) {
    //         this.finalWord = word.trim();
    //         this.orgRoot = root;
    //         this.word = replaceRoot(word, root, '_');
    //         this.count = 0;
    //         this.roots = [];
    //     }
    //
    //     var words = [];
    //
    //     data.map(function(term) {
    //         var rts = term.root.replace(/ /g,'').split(","),
    //             exs = angular.copy(term.examples);
    //
    //         for(var i in exs) {
    //             words.push(new Word(exs[i], rts[i]));
    //             //exs[i] =  replaceRoot(exs[i], rts[i]); //exs[i].replace(rts[i].toLowerCase().trim(), new Array(rts[i].length).join("-") );
    //         }
    //         roots.push(rts);
    //         examples.push(exs);
    //     });
    //
    //     roots = flattenArray(roots).sort(lengthSort);
    //     examples = flattenArray(examples);
    //
    //
    //     for(var i=0; i<words.length; i++) {
    //         var currentWord = words[i];
    //         for(var r=0; r<roots.length-11; r++) {
    //             var rt = roots[r];
    //             if(currentWord.word.toUpperCase().indexOf(rt) > -1) {
    //                 currentWord.count++;
    //                 currentWord.word = replaceRoot(currentWord.word, rt);
    //                 currentWord.roots.push(rt);
    //             }
    //         }
    //         if(currentWord.count>=2) console.log(currentWord);
    //     }
    // };

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

.service('roots', ['$http', 'rootsConfigurer', function($http, rootsConfigurer) {

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

function DefintionsController($scope, roots, rootsConfigurer, $rootScope) {
    $scope.define = function(wd) {
            roots.dictionary(w).success(function(data) {
                if(!data[0]) throw "Defintion not found for [" + w + "]";
                else console.log(data[0].text);
            }).catch(function(err) {
                console.error("Error getting [" + w + "].");
            });
    };

}
