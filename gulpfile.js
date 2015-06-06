'use strict';

var gulp   = require('gulp');
var jasmine = require('gulp-jasmine');

gulp.task('test', function () {
  return gulp.src('./spec/*.js')
    .pipe(jasmine({includeStackTrace: false}));
});

gulp.task('default', ['test']);
