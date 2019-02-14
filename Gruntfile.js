module.exports = function (grunt) {
  'use strict';

  grunt.initConfig({
    jshint: {
      sdk: {
        src: ['*.js', 'lib/*.js', 'public/*.js']
      },
      options: {
        jshintrc: '.jshintrc'
      }
    },

    copy: {
      'browserify-dist-setup': {
        expand: true,
        src: ['lib/**/*.js'],
        dest: 'build/dist/',
        options: {}
      }
    },

    browserify: {
      dist: {
        files: {
          'dist/aws-lex-audio.js': 'build/dist/lib/lex-audio.js'
        }
      }
    },

    uglify: {
      dist: {
        files: {
          'dist/aws-lex-audio.min.js': 'dist/aws-lex-audio.js'
        }
      }
    },

    watch: {
      scripts: {
        files: ['lib/*.js', 'public/*.*', 'Gruntfile.js'],
        tasks: ['release'],
        options: {
          spawn: false,
        }
      }
    },

    clean: {
      build: {
        options: {
          force: true
        },
        src: ['./build/**']
      }
    }
  });

  grunt.loadNpmTasks('grunt-contrib-jshint');
  grunt.loadNpmTasks('grunt-contrib-copy');
  grunt.loadNpmTasks('grunt-contrib-uglify');
  grunt.loadNpmTasks('grunt-contrib-clean');
  grunt.loadNpmTasks('grunt-contrib-watch');
  grunt.loadNpmTasks('grunt-browserify');

  grunt.registerTask('dist', ['copy:browserify-dist-setup', 'browserify:dist', 'uglify:dist']);
  grunt.registerTask('release', ['clean', 'dist']);

};
