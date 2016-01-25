angular.module("wordRoots", ['ui.router'])

.config(['$stateProvider', function ($stateProvider) {
    $stateProvider
        .state('tiles', {
            url: '/',
            templateUrl: './tiles.html',
            controller: ['$scope', 'roots', 'rootsConfigurer', '$rootScope', TilesController]
        })
        .state('defs', {
            url: '/defs',
            templateUrl: './defs.html',
            controller: ['$scope', 'roots', 'rootsConfigurer', '$rootScope', DefintionsController]
        });
}])

.run(['$rootScope', 'roots', 'rootsConfigurer', function($rootScope, roots, rootsConfigurer) {
    roots.kaplanRoots().success(function(data) {
        $rootScope.data =  data;
        console.log(data);
        rootsConfigurer.exampleLoader(data);
    });
}])

.controller('main', ['$scope', "$state", function($scope, $state) {
    $scope.isState = function(state) {
        return state === $state.current.name;
    };
}])

.service('rootsConfigurer', function() {
    var EXAMPLES = {};

    var DEFINTIONS = {};

    function rootParser(root) {
        return root;
    }

    function addExamples(root, examples) {
        var r = rootParser(root);
        var current = EXAMPLES[r];
        if(current) {
            examples = angular.isArray(examples) ? examples : [examples];
            for(var i in examples) {
                var ex = examples[i];
                if(!_.contains(current, ex)) {
                    EXAMPLES[r].push(ex);
                } else {
                    console.warn("The word " + ex + " is already in the root " + root + "!");
                }
            }
        } else {
            EXAMPLES[r] = examples;
        }
    }

    this.exampleLoader = function(data) {
        /*
        * Data in EXAMPLES.wordRoots will look like this:
        * ```js
        * {
        *   "A,AN": ['ANARCHY', 'AN'],
        *   "BELLI,BELL": ['BELLIGERENT', 'ANTEBELLUM']
        *   "CAD,CAS,CID": ['CADENCE', 'CASCADE', 'ACCIDENT']
        * }
        * ```
        * Passing in 'CAD' to a certain getter function will return all the CAD,CAS,CID roots. There will be a certain
        * Regex parser that does so.
        *
        * The exampleLoader function will take in data, and add all of its examples to the examples array.
        */
        for(var i in data) {
            var rootTerm = data[i];
            var root = _.cleanRoot(rootTerm.root);
            var examples = rootTerm.examples;

            addExamples(root, examples);
        }
        console.log(EXAMPLES);
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
        cleanRoot: function(root) {
            return root.replace(/ /g, '').toUpperCase();
        },
        contains: function(arr, str) {
            var res = false;
            str = str.trim().toLowerCase();
            for(var i in arr) {
                if(arr[i].toLowerCase().indexOf(str) > -1) return true;
            }
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
        var roots = $(".terms .term .text .word .TermText", html).toArray();
        var qdef = $(".terms .term .text .definition .TermText", html).toArray();
        function Word(root, qdef) {
            this.word = root;
            this.def = qdef.substring(0, qdef.indexOf("(")-1);
            this.examples = qdef.substring(qdef.indexOf("(")+1, qdef.length-1);
        }
        var words = [];
        for(var i=0; i<roots.length; i++) {
            var root = $(roots[i]).text();
            var def = $(qdef[i]).text();
            words.push(new Word(root, def));
        }
        return words;
    };
})

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

}])
;

function DefintionsController($scope, roots, rootsConfigurer, $rootScope) {
    roots.examples().success(function(data) {
        $scope.examples = data;
    });
}


function TilesController($scope, roots, rootsConfigurer, $rootScope) {
    $scope.loading=!$rootScope.data;


    roots.examples().success(function(data) {
        $scope.examples = data;
    });



    $scope.openModal = function(root) {
        $scope.currentWordRootExample = '';
        $scope.currentWordRoot = root;
        $scope.examples.forEach(function(n) {
            if(root.indexOf(n.root) > -1)
                $scope.currentWordRootExample += n.examples.toUpperCase() + '\n';
        });
        $('#myModal').modal();
    };
}
