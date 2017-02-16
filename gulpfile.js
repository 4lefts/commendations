const gulp = require('gulp')
const babel = require('gulp-babel')
const sass = require('gulp-sass')
const prefix = require('gulp-autoprefixer')

gulp.task('moveHtml', () => {
  return gulp.src('src/**/*.html')
    .pipe(gulp.dest('public'))
})

gulp.task('transpileEs6', () => {
  return gulp.src('src/**/*.js')
    .pipe(babel({
      presets: ['latest'],
    }))
    .pipe(gulp.dest('public'))
})

gulp.task('transpileCss', () => {
  return gulp.src('src/**/*.scss')
    .pipe(sass({
      outputStyle: 'compressed',
    }))
    .pipe(prefix({
      browsers: ['last 2 versions'],
    }))
    .pipe(gulp.dest('public'))
})

gulp.task('watch', () => {
  gulp.watch('src/**/*', ['default'])
})

gulp.task('default', ['moveHtml', 'transpileCss', 'transpileEs6'])
