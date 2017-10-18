const gulp = require('gulp')
const babel = require('gulp-babel')
const sass = require('gulp-sass')
const prefix = require('gulp-autoprefixer')
const plumber = require('gulp-plumber')
const browserSync = require('browser-sync')
const reload = browserSync.reload

gulp.task('moveHtml', () => {
  return gulp.src('src/**/*.html')
    .pipe(plumber())
    .pipe(gulp.dest('public'))
})

gulp.task('moveImages', () => {
  return gulp.src('src/images/*')
    .pipe(plumber())
    .pipe(gulp.dest('public/images'))
})

gulp.task('transpileEs6', () => {
  return gulp.src('src/**/*.js')
    .pipe(plumber())
    .pipe(babel({
      presets: ['latest'],
    }))
    .pipe(gulp.dest('public'))
})

gulp.task('transpileCss', () => {
  return gulp.src('src/**/*.scss')
    .pipe(plumber())
    .pipe(sass({
      outputStyle: 'expanded',
    }))
    .pipe(prefix({
      browsers: ['last 2 versions'],
    }))
    .pipe(gulp.dest('public'))
})

gulp.task('default', ['moveHtml', 'moveImages', 'transpileCss', 'transpileEs6'])

gulp.task('watch', () => {
  browserSync({server: './public'})
  gulp.watch('./src/**/*', ['watcher'])
})

gulp.task('watcher', ['moveHtml', 'moveImages', 'transpileCss', 'transpileEs6'], reload)
