#!/usr/bin/env node

(function() {
  var action, arg, argv, cheerio, colors, doWork, fs, readCourseList, readVideoDetailAndDownload, readVideoList, request, searchCourse, value, website;

  request = require('request');

  cheerio = require('cheerio');

  fs = require('fs');

  colors = require('colors');

  website = 'http://www.imooc.com';


  /*
   * Read video list
   * @param {String} URL
   * @param {Function} callback
   */

  readVideoList = function(url, callback) {
    console.log(colors.gray("Read video list: " + url));
    request.get(url, function(err, res) {
      var $, videos;
      if (err) {
        return callback(err);
      }
      if (res && res.statusCode === 200) {
        $ = cheerio.load(res.body);
        videos = [];
        $('.J-media-item').each(function() {
          var $me, item;
          $me = $(this);
          item = {
            id: $me.attr('href').match(/\d+/)[0],
            name: $me.text().trim()
          };
          return videos.push(item);
        });
        return callback(null, videos);
      }
    });
  };


  /*
   * Read video detail
   * @param {Object} video
   * @param {Function} callback
   */

  readVideoDetailAndDownload = function(video, callback) {
    var api, url;
    api = website + '/course/ajaxmediainfo/?mode=flash&mid=';
    url = api + video.id;
    console.log(colors.gray("Read video detail and download: " + video.name + ".mp4 , url: " + url));
    request.get(url, function(err, res) {
      var body, filename;
      if (err) {
        return callback(err);
      }
      if (res && res.statusCode === 200) {
        body = JSON.parse(res.body);
        if (body.result === 0) {
          filename = video.name.replace(/([\\\/\:\*\?\"\<\>\|])/g, '_') + '.mp4';
          request(body.data.result.mpath[0]).pipe(fs.createWriteStream(filename));
        } else {
          return callback(body.msg);
        }
      }
    });
  };


  /*
   * Read course list
   * @param {String} url
   * @param {Function} callback
   */

  readCourseList = function(url, callback) {
    console.log(colors.gray("Read course list: " + url));
    request(url, function(err, res) {
      var $, courseItem, courses, nextPage, nextPageURL;
      if (err) {
        return callback(err);
      }
      if (res && res.statusCode === 200) {
        $ = cheerio.load(res.body);
        courses = [];
        courseItem = $('.course-item');
        courseItem.each(function() {
          var $me, item;
          $me = $(this);
          item = {
            title: $me.find('.title').text().trim(),
            description: $me.find('.description').text().trim(),
            url: website + $me.find('a').attr('href')
          };
          return courses.push(item);
        });
        nextPage = $('.page').find('.active').next().attr('data-page');
        if (!nextPage) {
          return callback(null, courses);
        }
        nextPageURL = url.replace(/(\d+$)/, nextPage);
        readCourseList(nextPageURL, function(err, courses2) {
          if (err) {
            return callback(err);
          }
          return callback(null, courses.concat(courses2));
        });
      }
    });
  };


  /*
   * Search course
   * @param {String} words
   * @param {Function} callback
   */

  searchCourse = function(words, callback) {
    var url;
    url = website + '/index/search?words=' + words + '&page=1';
    request(url, function(err, res) {
      var $, courseItem;
      if (err) {
        return callback(err);
      }
      if (res && res.statusCode === 200) {
        $ = cheerio.load(res.body);
        courseItem = $('.course-item');
        if (!courseItem.length) {
          return callback("There is no result on \"" + words + "\".");
        }
        readCourseList(url, callback);
      }
    });
  };


  /*
   * Do work
   * @param {String} action
   * @param {String} value
   * @param {Function} callback
   */

  doWork = function(action, value, callback) {
    var url;
    switch (action) {
      case '--search':
        if (!value) {
          return callback('Please input keywords.');
        }
        return searchCourse(value, callback);
      case '--list':
        if (!value) {
          return callback('Please input course URL or ID');
        }
        url = isNaN(value) ? value : website + '/learn/' + value;
        return readVideoList(url, callback);
      case '--download':
        if (!value) {
          return callback('Please input course URL or ID');
        }
        url = isNaN(value) ? value : website + '/learn/' + value;
        readVideoList(url, function(err, video) {
          if (err) {
            return callback(err);
          }
          return readVideoDetailAndDownload(video, callback);
        });
        break;
      default:
        return callback('Unknown action.');
    }
  };

  argv = process.argv.slice(2);

  if (!argv[0]) {
    console.log("Usage: crawler.coffee [Options]");
    console.log("  --search\t Search for the specified keywords");
    console.log("  --list\t List the video list under the specified course ID or URL");
    console.log("  --download\t Download the video list under the specified course ID or URL");
    return;
  }

  for (arg in argv) {
    if (arg % 2 !== 0) {
      continue;
    }
    action = argv[arg];
    value = argv[Number(arg) + 1];
    doWork(action, value, function(err, res) {
      var arr, i, key, len, val;
      if (err) {
        return console.error(colors.red(err));
      }
      for (i = 0, len = res.length; i < len; i++) {
        arr = res[i];
        console.log('-'.repeat(30));
        for (key in arr) {
          val = arr[key];
          console.log((colors.green(key)) + ": " + val);
        }
      }
    });
  }

}).call(this);
