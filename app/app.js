angular.module("wordRoots", ['ui.router'])

.config(['$stateProvider', function ($stateProvider) {
  $stateProvider
    .state('tiles', {
      url: '/tiles',
      templateUrl: './tiles.html',
      controller: ['$scope', 'roots', 'rootsConfigurer', TilesController]
    })
    .state('defs', {
      url: 'defs',
      template: 'Defs to be implemented!'
    });
}])

.service('rootsConfigurer', function() {

    function flattenArray(arr) {
        return arr.reduce(function(a,b) {
            return a.concat(b);
        }, []);
    }

    function lengthSort(a, b){
      return b.length - a.length;
    }

    function replaceRoot(str, root, replace) {
        var x = new Array(root.length).join(replace || "-");
        return str.replace(root.toLowerCase().trim(), x);
    }

    this.exampleList = function(data) {
        var roots = [];
        var examples = [];

        function Word(word, root) {
            this.finalWord = word.trim();
            this.orgRoot = root;
            this.word = replaceRoot(word, root, '_');
            this.count = 0;
            this.roots = [];
        }

        var words = [];

        data.map(function(term) {
            var rts = term.root.replace(/ /g,'').split(","),
                exs = angular.copy(term.examples);

            for(var i in exs) {
                words.push(new Word(exs[i], rts[i]));
                //exs[i] =  replaceRoot(exs[i], rts[i]); //exs[i].replace(rts[i].toLowerCase().trim(), new Array(rts[i].length).join("-") );
            }
            roots.push(rts);
            examples.push(exs);
        });

        roots = flattenArray(roots).sort(lengthSort);
        examples = flattenArray(examples);


        for(var i=0; i<words.length; i++) {
            var currentWord = words[i];
            for(var r=0; r<roots.length-11; r++) {
                var rt = roots[r];
                if(currentWord.word.toUpperCase().indexOf(rt) > -1) {
                    currentWord.count++;
                    currentWord.word = replaceRoot(currentWord.word, rt);
                    currentWord.roots.push(rt);
                }
            }
            if(currentWord.count>=2) console.log(currentWord);
        }
    };

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

function TilesController($scope, roots, rootsConfigurer) {
$scope.loading=true;
    var rootConfigure = {
        jason: function() {roots.kaplanRoots().success(function(data) {
         $scope.loading= false;
            $scope.data =  data;
            rootsConfigurer.exampleList(data);
        });},
        rebecca: function() {roots.quizletRoots().success(function(data) {
            var transformedData = [];
            for(var k in data) {
                data[k].root = k;
                data[k].examples = data[k].examples.split(",");
                transformedData.push(data[k]);
            }
            $scope.data =  transformedData;
            rootsConfigurer.exampleList(transformedData);
        });}
    };

    rootConfigure.jason();



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
