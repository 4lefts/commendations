'use strict';

$(document).ready(function () {
  (function () {
    // Initialize Firebase
    var config = {
      apiKey: "AIzaSyDl-Ep3w5gJIwUA1ZQ7syUmW1DZ6fV2EhI",
      authDomain: "commendations01.firebaseapp.com",
      databaseURL: "https://commendations01.firebaseio.com",
      storageBucket: "commendations01.appspot.com",
      messagingSenderId: "856242512076"
    };
    firebase.initializeApp(config);

    //auth
    var provider = new firebase.auth.GoogleAuthProvider();

    //db refs
    var commendationsRef = firebase.database().ref().child('commendations');
    var adminsDbRef = firebase.database().ref().child('admins');
    var userRefs = [];

    //set initial filter date as the beginning of current academic year
    var initialFilterDate = setInitialFilterDate();
    var filterDate = initialFilterDate;
    //helper function to get yyyy-mm-dd string of start of current academic year
    function setInitialFilterDate(cb) {
      var tempD = new Date();
      var tempY = void 0;
      if (tempD.getMonth() < 8) {
        tempY = tempD.getFullYear() - 1;
      } else {
        tempY = tempD.getFullYear();
      }
      return tempY + "-09-01";
    }

    //CACHE DOM//
    var $commendationsContainer = $('#commendations-container');

    //form elements
    var $commendationsForm = $('#commendations-form');
    var $name = $('#name');
    var $className = $('#class-name');
    var $reason = $('#reason');
    var $sendButton = $('#send-button');

    //controls for filtering and printing all
    var $controlsForm = $('#controls-form');
    //stop date filter control from setting date in future
    var today = new Date().toISOString().split('T')[0]; //get yyyy-mm-dd
    $('#date-filter').attr('max', today);
    //p element to display the current filter date
    var $since = $('#since');
    renderSinceParagraph(filterDate);

    // cache header for logging in and out
    var $headerContainer = $('#header-container-outer');

    //EVENT LISTENERS//

    //add listener to login button
    $headerContainer.on('click', '#login-btn', function () {
      firebase.auth().signInWithPopup(provider).then(function (result) {}).catch(function (err) {
        return console.log(err);
      });
    });

    //and logout button
    $headerContainer.on('click', '#logout-btn', function () {
      console.log('logging out!');
      firebase.auth().signOut().then(function () {}, function (err) {
        return console.log('error:' + err);
      });
    });

    //add form listener to send commendation
    $sendButton.on('click', function (event) {
      var usr = firebase.auth().currentUser;
      submitCommendation($name.val(), $className.val(), $reason.val(), usr);
      //reset the form
      $(event.target).closest('form').find('input:text, textarea').val('');
      return false;
    });

    //print one commendation
    $commendationsContainer.on('click', '.print-btn', function (event) {
      printOneCommendation(event);
    });

    //delete one commendation
    $commendationsContainer.on('click', '.delete-btn', function (event) {
      var $commendationToDelete = $(event.target).closest('.commendation');
      var dataId = $commendationToDelete.attr('data-id');
      var uid = $commendationToDelete.attr('data-owner');
      var conf = renderDeleteModal(uid, dataId);
      return false;
    });

    //handle confirm and cancel buttons for deleting modal
    $('body').on('click', '#confirm-delete-button', function (event) {
      var $thisBtn = $(event.target);
      var dataId = $thisBtn.attr('data-id');
      var uid = $thisBtn.attr('data-uid');
      deleteCommendation(uid, dataId);
      $thisBtn.closest('.modal-container').remove();
    });

    $('body').on('click', '#cancel-delete-button', function (event) {
      $(event.target).closest('.modal-container').remove();
    });

    function deleteCommendation(u, d) {
      console.log("deleting: " + d);
      commendationsRef.child(u).child(d).remove().then(function () {
        console.log('removed from fb!');
      }).catch(function (err) {
        console.log(error);
      });
    }

    $controlsForm.on('click', '#date-filter-button', function (event) {
      var $dateInput = $(event.target).prev();
      filterDate = $dateInput.val() || initialFilterDate;
      removeAllCommendations($commendationsContainer);
      userRefs.forEach(function (elem) {
        attachCommendationListeners(elem, filterDate);
      });
      console.log("new filter date is: " + filterDate);
      $dateInput.val('');
      renderSinceParagraph(filterDate);
      return false;
    });

    $controlsForm.on('click', '#print-all-button', function (event) {
      printAllCommendations();
      return false;
    });

    //observe changes to auth state
    firebase.auth().onAuthStateChanged(function (user) {
      if (user) {
        var isAdmin = false;
        adminsDbRef.once('value').then(function (snapshot) {
          if (snapshot.val().hasOwnProperty(user.uid)) {
            isAdmin = true;
          } else {
            isAdmin = false;
          }
          console.log("are you an admin?: " + isAdmin);
          makeCommendationRefsArray(isAdmin, user.uid, function () {
            userRefs.forEach(function (elem) {
              attachCommendationListeners(elem, filterDate);
            });
          });
          if (isAdmin) {
            $controlsForm.removeClass('hidden');
            // renderControlsForm($controlsFormContainer)
          } else {
            $controlsForm.addClass('hidden');
            // removeControlsForm($controlsFormContainer)
          }
        });
        $commendationsForm.removeClass('hidden');
      } else {
        removeAllCommendations($commendationsContainer);
        $controlsForm.addClass('hidden');
        $commendationsForm.addClass('hidden');
      }
      renderHeader(user);
    });

    //sort of middleware - creates an array of uids to attach listners to
    function makeCommendationRefsArray(isAd, uid, cb) {
      //get firebase to listen for child event on each of the db refs
      //for a normal user, this will be an array with only one element,
      //while admins will get everyone
      var refsArray = [];
      //listen for everything (isAdmin == true)
      if (isAd) {
        //get all the uid's in the commendations db
        commendationsRef.once('value').then(function (snapshot) {
          for (var key in snapshot.val()) {
            refsArray.push(key);
          }
          console.log(refsArray);
          userRefs = refsArray;
          cb();
        });
      } else {
        //or listen for specific user
        refsArray.push(uid);
        console.log(refsArray);
        userRefs = refsArray;
        cb();
      }
    }

    //listens for child events added/removed from db, not events on the DOM
    function attachCommendationListeners(ref, dateSince) {
      //db listeners for child events also query according to date
      var thisChild = commendationsRef.child(ref);
      thisChild.orderByChild('date').startAt(dateSince).on('child_added', function (snapshot) {
        return renderCommendation(snapshot);
      });
      thisChild.on('child_removed', function (snapshot) {
        return removeOneCommendation(snapshot);
      });
    }

    //called be the submit button
    function submitCommendation(name, className, reason, usr) {
      var d = new Date();
      var t = d.getTime();
      var today = makeDateString(d);
      var newData = {
        name: name,
        className: className,
        date: today,
        reason: reason,
        displayName: usr.displayName,
        uid: usr.uid,
        timestamp: t
      };
      var newKey = commendationsRef.child(usr.uid).push().key;
      commendationsRef.child(usr.uid).child(newKey).set(newData).then(function () {
        //success pop up here
      }).catch(function (error) {
        //error popup here
        console.log(error);
      }); //error handler in here?
    }

    //helper to get date in yyyy-mm-dd format for ordering
    function makeDateString(d) {
      var tmp = d.toDateString().split(' ').slice(1);
      var m1 = monthToNumber(tmp[0]);
      var m2 = zeroPad(m1);
      var d1 = zeroPad(tmp[1]);
      var today = tmp[2] + "-" + m2 + "-" + d1;
      return today;
      function monthToNumber(m) {
        //ugly hack to get jan = 1
        var months = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        //zero pad date
        return months.indexOf(m).toString();
      }
      function zeroPad(s) {
        if (s.length == 2) {
          return s;
        } else {
          return '0' + s;
        }
      }
    }

    //called when auth state changes
    function renderHeader(usr) {
      if (usr) {
        var html = "\n        <div id=\"header-container\">\n          <div class=\"header main-header\">\n            <h1>Decoy School Commendations</h1>\n            <button id=\"logout-btn\">Log Out</button>\n          </div>\n        </div>\n        <div id=\"sub-header-container\">\n          <div class=\"header sub-header\">\n            <p>Logged in as " + usr.displayName + "</p>\n          </div>\n        </div>\n        ";
        console.log("signed in as " + usr.uid);
        $headerContainer.html(html);
      } else {
        var _html = "\n        <div id=\"login-container\">\n          <div id=\"login-screen\">\n            <h3>Weclome to</h3>\n            <h1>Decoy Primary Commendations</h1>\n            " + logoTemplate('#ffffff', '0.5', 300) + "\n            <button id=\"login-btn\">Log In</button>\n          </div>\n        </div>\n        ";
        console.log('signed out!');
        $headerContainer.html(_html);
      }
    }

    //renders paragraph in controls form to show date filtered since
    //called by initial setup and by filter button
    function renderSinceParagraph(d) {
      $since.text("(Currently displaying commendations made since " + d + ")");
    }

    //called when children are added to db reference
    function renderCommendation(snapshot) {
      var val = snapshot.val();
      var html = "\n      <div class=\"commendation\" data-id=\"" + snapshot.key + "\" data-owner=\"" + val.uid + "\">\n        <div class=\"header commendation-header\">\n          <h3><span class=\"commendation-name\">" + val.name + "</span> - <span class=\"commendation-class\">" + val.className + "</span> - <span class=\"commendation-date\">(" + val.date + ")</span></h3>\n          <div>\n            <button class=\"print-btn\">Print</button>\n            <button class=\"delete-btn\">Delete</button>\n          </div>\n        </div>\n        <p class=\"commendation-reason\">" + val.reason + "</p>\n        <p class=\"commendation-by\">By " + val.displayName + "</p>\n      </div>\n      ";
      $commendationsContainer.prepend(html);
    }

    //called by clicking on individual delete buttons
    function renderDeleteModal(u, d) {
      var html = "\n        <div class=\"modal-container\">\n          <div class=\"modal-body\">\n            <h3>Do you really want to delete this commendation?</h3>\n            <div>\n              <button type=\"button\" id=\"confirm-delete-button\" data-uid=\"" + u + "\" data-id=\"" + d + "\">Yes</button>\n              <button type=\"button\" id=\"cancel-delete-button\">No</button>\n            </div>\n          </div>\n        </div>\n      ";
      $('body').append(html);
    }

    //called by the print buttons
    function printOneCommendation(event) {
      //cache elements from commendation to print
      var $currentCommendation = $(event.target).closest('.commendation');
      var id = $currentCommendation.attr('data-id');
      //format name and class
      var name = $currentCommendation.find('.commendation-name').html();
      var schoolClass = $currentCommendation.find('.commendation-class').html();
      //slice brackets off date
      var date = $currentCommendation.find('.commendation-date').html().slice(1, -1);
      //get reason and author
      var reason = $currentCommendation.find('.commendation-reason').html();
      //slice off the word 'by'
      var by = $currentCommendation.find('.commendation-by').html().slice(2);
      var printLogo = logoTemplate('#000000', '1', 100);
      //render template
      var html = "\n      <div class=\"printing\" id=\"printing-" + id + "\">\n        <div class=\"banner\">\n          <div class=\"logo-left\">" + printLogo + "</div>\n          <h2>Decoy Community Primary School</h2>\n          <h2>Certificate of Commendation</h2>\n          <div class=\"logo-right\">" + printLogo + "</div>\n          <p>This certificate is awarded to</p>\n          <h1>" + name + "</h1>\n          <p>in " + schoolClass + "</p>\n        </div>\n        <p>For " + reason + "</p>\n        <p>Nominated by " + by + ", " + date + "</p>\n        <p>Signed:</p>\n        <div class=\"sig-box\">\n          <img src=\"./images/sig-temp.png\">\n          <p>Mrs G O'Neill, headteacher</p>\n        </div>\n      </div>\n      ";
      $commendationsContainer.append(html);
      //set timeout is a hack to make sure imgs in the printed template are
      //loaded. can be removed once inline svgs are in place.
      setTimeout(function () {
        window.print();
        $('.printing').remove();
      }, 250);
    }

    //called by the print buttons
    function printAllCommendations(event) {
      var html = '';
      $('.commendation').each(function (index, value) {
        var $curCommendation = $(value);
        var name = $curCommendation.find('.commendation-name').html();
        var schoolClass = $curCommendation.find('.commendation-class').html();
        //slice off brackets:
        var date = $curCommendation.find('.commendation-date').html().slice(1, -1);
        var reason = $curCommendation.find('.commendation-reason').html();
        //slice off word 'by':
        var by = $curCommendation.find('.commendation-by').html().slice(2);
        var printLogo = logoTemplate('#000000', '1', 100);
        var templateHtml = "\n        <div class=\"printing\">\n         <div class=\"banner\">\n           <div class=\"logo-left\">" + printLogo + "</div>\n             <h2>Decoy Community Primary School</h2>\n             <h2>Certificate of Commendation</h2>\n           <div class=\"logo-right\">" + printLogo + "</div>\n           <p>This certificate is awarded to</p>\n           <h1>" + name + "</h1>\n           <p>in " + schoolClass + "</p>\n         </div>\n           <p>For " + reason + "</p>\n           <p>Nominated by " + by + ", " + date + "</p>\n           <p>Signed:</p>\n         <div class=\"sig-box\">\n           <img src=\"./images/sig-temp.png\">\n           <p>Mrs G O'Neill, headteacher</p>\n         </div>\n        </div>\n        ";
        html += templateHtml;
      });
      $commendationsContainer.append(html);
      //set timeout is a hack to make sure imgs in the printed template are
      //loaded. can be removed once inline svgs are in place.
      setTimeout(function () {
        window.print();
        $('.printing').remove();
      }, 250);
    }

    //called by delete buttons (when children are removed from the db ref)
    function removeOneCommendation(snapshot) {
      var $divToRemove = $("div[data-id=\"" + snapshot.key + "\"]");
      $divToRemove.slideUp(300, function () {
        $divToRemove.remove();
      });
    }

    //called on logout by change in auth state
    function removeAllCommendations($container) {
      var $allDivs = $container.find('div');
      $allDivs.each(function (index, value) {
        $(value).remove();
        console.log('removing!');
      });
    }

    //returns inline svg of logo, supply size in px and colour as #
    function logoTemplate(colour, opacity, size) {
      return "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"" + size + "\" height=\"" + size + "\" viewBox=\"0 0 570 570\"><path d=\"m410.2 12.6c13.4-18.8 2.2 23.7 12.8 17 0.5 10.1-21.3 39.9 1.8 26.6 3.8-21.6 16.9-8.1 7.1 5.5-10.4 25.9-48.5 23.7-56.6 51.2-0.6 16.9 26.3 21.9 35.5 36 11 5.8 38 6.8 24.3 25.4-17.7 8.6-37.8 12.7-39.3 36.8-7.9 19.3-9.4 41.9 0.5 60.5 11.5 19.8-10.9 59.5 23.4 61.6 18.8-5 53.6 0.1 44.7 27.1-13.4 17.9-11.6 43.1-27.6 58.8-9.1 9.6-35.9 24.8-27.4-0.5 1.8-13.5 21-19 14-37.5-1.1-29.4-31.4 5.6-46.2 7.6-20.9 5-42.3 4.7-63.5 6.2-25.7 0.7-52.8-2.6-77.1 7.2-22.3 11.3-30.5 36.9-51.5 49.2-18.6 14.9-51.3 8.7-61.9 32.9 0.2 29.1-11.1 53.9-36 69.5-16.2 17.3-18.1-27.6 0.9-25.1 18.4-14.6 13.6-40.5 16.9-61.1 6.4-24.9 38.3-34.9 40.7-63.1 4.1-18.9-3.1-38.8 2.7-58 4.1-15.6-23.8-34.5 5.4-34.6 11.1 0 13.7 17.6 27 4.6 26.3-6.3 54.1-2 80-10.9 32.9-11.4 61.1-36.6 74.2-69.1 14-26.7 17-58.2 15.5-87.9-18.1-6.1-36.9-55-5.3-40.2 21.1 21.4 6.8-25.2-1.6-33.7-12.4-22.5 8.9-6.1 14.6 4.1 23.5 2.8 21.8-32.5 24.8-48.9 12.1-11.5 5.8 38.6 15.8 14.5 6.7-9.3 10.2-20.5 11.4-31.8z\" fill=\"" + colour + "\" fill-opacity=\"" + opacity + "\"/></svg>";
    }
  })();
});