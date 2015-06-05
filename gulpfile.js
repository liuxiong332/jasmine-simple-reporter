'use strict';

var gulp   = require('gulp');
var jasmine = require('gulp-jasmine');

gulp.task('test', function (cb) {
  return gulp.src(['./spec/*.js'], {read: false})
    .pipe(jasmine())
});

gulp.task('default', 'test');
