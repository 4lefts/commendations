'use strict';

$(document).ready(function () {

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
  //i.e. sept first
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
  //vars to decide what key stages to display
  var showKS1 = true;
  var showKS2 = true;

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
  var $ksFilters = $('#ks-filters');

  //jquery ui date picker
  var $dateInput = $('#date-filter').datepicker({
    dateFormat: 'yy-mm-dd',
    minDate: new Date(initialFilterDate),
    maxDate: 0 });
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
    firebase.auth().signOut().then(function () {}, function (err) {
      return console.log('error:' + err);
    });
  });

  //add form listener to send commendation
  $sendButton.on('click', function (event) {
    var $msg = $commendationsForm.find('p.message');
    if ($commendationsForm[0].checkValidity()) {
      var usr = firebase.auth().currentUser;
      submitCommendation($name.val(), $className.val(), $reason.val(), usr);
      //reset the form
      $(event.target).closest('form').find('input:text, textarea').val('');
      $(event.target).closest('form').find('select').val('nothing');
      if (!$msg.hasClass('hidden')) $msg.addClass('hidden');
    } else {
      if ($msg.hasClass('hidden')) $msg.removeClass('hidden');
    }
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
    commendationsRef.child(u).child(d).remove().then(function () {}).catch(function (err) {
      console.log(error);
    });
  }

  $controlsForm.on('click', '#date-filter-button', function (event) {
    filterDate = $dateInput.val() || initialFilterDate;
    removeAllCommendations($commendationsContainer);
    userRefs.forEach(function (elem) {
      attachCommendationListeners(elem, filterDate);
    });
    $dateInput.val('');
    renderSinceParagraph(filterDate);
    return false;
  });

  $controlsForm.on('click', '#print-all-button', function (event) {
    printAllCommendations();
    return false;
  });

  $ksFilters.on('click', 'input[type="checkbox"]', function (event) {
    if (event.target.value === 'ks1') {
      showKS1 = event.target.checked;
    } else if (event.target.value === 'ks2') {
      showKS2 = event.target.checked;
    }
    if (showKS1) {
      $commendationsContainer.find('div.ks1').removeClass('hidden');
    } else {
      $commendationsContainer.find('div.ks1').addClass('hidden');
    }
    if (showKS2) {
      $commendationsContainer.find('div.ks2').removeClass('hidden');
    } else {
      $commendationsContainer.find('div.ks2').addClass('hidden');
    }
  });

  //observe changes to auth state
  firebase.auth().onAuthStateChanged(function (user) {
    if (user && checkEmail(user.email)) {
      //if this person is a decoy member of staff
      var isAdmin = false;
      adminsDbRef.once('value').then(function (snapshot) {
        if (snapshot.val().hasOwnProperty(user.uid)) {
          isAdmin = true;
        } else {
          isAdmin = false;
        }
        makeCommendationRefsArray(isAdmin, user.uid, function () {
          userRefs.forEach(function (elem) {
            attachCommendationListeners(elem, filterDate);
          });
        });
        if (isAdmin) {
          $controlsForm.removeClass('hidden');
        } else {
          $controlsForm.addClass('hidden');
        }
      });
      renderHeader(user);
      $commendationsForm.removeClass('hidden');
    } else if (user && !checkEmail(user.email)) {
      // if not a member of staff
      renderInvalidUserHeader();
      setTimeout(function () {
        firebase.auth().signOut().then(function () {}, function (err) {
          return console.log('error:' + err);
        });
      }, 3000);
      console.log('not a valid user');
    } else if (!user) {
      // if not user (if signed out)
      removeAllCommendations($commendationsContainer);
      $controlsForm.addClass('hidden');
      $commendationsForm.addClass('hidden');
      renderHeader(user);
    }
  });

  function checkEmail(address) {
    return (/^[^0-9]+@decoyschool.co.uk$/.test(address)
    );
  }

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
        userRefs = refsArray;
        cb();
      });
    } else {
      //or listen for specific user
      refsArray.push(uid);
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
    var keyStage = calcKeyStage(className);
    var newData = {
      name: name,
      className: className,
      keyStage: keyStage,
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
      console.log(newData);
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

  //helper function to work out key stage for a student's class
  function calcKeyStage(c) {
    var ks1Classes = ["Butterflies", "Ladybirds", "Woodpeckers", "Wrens", "Chaffinches", "Partridges"];
    var ks2Classes = ["Puffins", "Swans", "Kingfishers", "Mallards", "Kestrels", "Owls", "Eagles", "Falcons"];
    if (ks1Classes.includes(c)) {
      return 'ks1';
    } else if (ks2Classes.includes(c)) {
      return 'ks2';
    }
  }

  //called when auth state changes
  function renderHeader(usr) {
    if (usr && checkEmail(usr.email)) {
      var html = "\n        <div id=\"header-container\">\n          <div class=\"header main-header\">\n            <h1>Decoy School Commendations</h1>\n            <button id=\"logout-btn\">Log Out</button>\n          </div>\n        </div>\n        <div id=\"sub-header-container\">\n          <div class=\"header sub-header\">\n            <p>Logged in as " + usr.displayName + "</p>\n          </div>\n        </div>\n        ";
      console.log("signed in as " + usr.uid);
      $headerContainer.html(html);
    } else {
      var _html = "\n        <div id=\"login-container\">\n          <div id=\"login-screen\">\n            <h3>Welcome to</h3>\n            <h1>Decoy Primary Commendations</h1>\n            " + logoTemplate('#ffffff', '0.5', 300) + "\n            <button id=\"login-btn\">Log In</button>\n          </div>\n        </div>\n        ";
      $headerContainer.html(_html);
    }
  }

  function renderInvalidUserHeader() {
    var html = "\n      <div id=\"login-container\">\n        <div id=\"login-screen\">\n          <h3>Sorry, not a valid user</h3>\n          <h3>You must use a Decoy School staff user account</h3>\n          " + logoTemplate('#ffffff', '0.5', 300) + "\n        </div>\n      </div>\n      ";
    $headerContainer.html(html);
  }

  //renders paragraph in controls form to show date filtered since
  //called by initial setup and by filter button
  function renderSinceParagraph(d) {
    $since.text("(Currently displaying commendations made since " + d + ")");
  }

  //called when children are added to db reference
  function renderCommendation(snapshot) {
    var val = snapshot.val();
    var hide = val.keyStage === 'ks1' && showKS1 || val.keyStage === 'ks2' && showKS2 ? '' : 'hidden';
    var html = "\n      <div class=\"commendation " + val.keyStage + " " + hide + "\" data-id=\"" + snapshot.key + "\" data-owner=\"" + val.uid + "\">\n        <div class=\"commendation-header\">\n          <div class=\"commendation-info\">\n            <h6><span class=\"commendation-date\">" + val.date + "</span><span class=\"commendation-by\">, by " + val.displayName + "</span></h6>\n            <h3 class=\"commendation-name\">" + val.name + "</h3>\n            <h6 class=\"commendation-class\">" + val.className + "</h6>\n          </div>\n          <div class=\"commendation-buttons\">\n            <button class=\"print-btn\"><img src=\"./images/print.svg\" alt=\"print button\"></button>\n            <button class=\"delete-btn\"><img src=\"./images/delete.svg\" alt=\"delete button\"></button>\n          </div>\n        </div>\n        <p class=\"commendation-reason\">" + val.reason + "</p>\n      </div>\n      ";
    $commendationsContainer.prepend(html);
  }

  //called by clicking on individual delete buttons
  function renderDeleteModal(u, d) {
    var html = "\n        <div class=\"modal-container\">\n          <div class=\"modal-body\">\n            <h3>Do you really want to delete this commendation?</h3>\n            <div>\n              <button type=\"button\" id=\"confirm-delete-button\" data-uid=\"" + u + "\" data-id=\"" + d + "\">Yes</button>\n              <button type=\"button\" id=\"cancel-delete-button\">No</button>\n            </div>\n          </div>\n        </div>\n      ";
    $('body').append(html);
  }

  //called by the print buttons
  function printOneCommendation(event) {
    var $currentCommendation = $(event.target).closest('.commendation');
    var html = renderPrintCommendation($currentCommendation);
    $commendationsContainer.append(html);
    window.print();
    $('.printing').remove();
  }

  //called by the print all button
  function printAllCommendations(event) {
    var html = '';
    $('.commendation').each(function (index, value) {
      var $curCommendation = $(value);
      if (!$curCommendation.hasClass('hidden')) {
        html += renderPrintCommendation($curCommendation);
      }
    });
    $commendationsContainer.append(html);
    window.print();
    $('.printing').remove();
  }

  //renders an html template of the commendation to print
  function renderPrintCommendation($commendation) {
    //cache elements from commendation to print
    var id = $commendation.attr('data-id');
    //format name and class
    var name = $commendation.find('.commendation-name').html();
    var schoolClass = $commendation.find('.commendation-class').html();
    //slice brackets off date and reverse
    var date = $commendation.find('.commendation-date').html().split('-').reverse().join('/');
    //get reason and author
    var reason = $commendation.find('.commendation-reason').html();
    //slice off the word 'by'
    var by = $commendation.find('.commendation-by').html().slice(4);
    var printLogo = logoTemplate('#000000', '1', 100);
    var printSig = sigTemplate(120);
    //render template
    var html = "\n      <div class=\"printing\" id=\"printing-" + id + "\">\n        <div class=\"banner\">\n          <div class=\"logo-left\">" + printLogo + "</div>\n          <h2>Decoy Community Primary School</h2>\n          <h2>Certificate of Commendation</h2>\n          <div class=\"logo-right\">" + printLogo + "</div>\n          <p>This certificate is awarded to</p>\n          <h1>" + name + "</h1>\n          <p>in " + schoolClass + "</p>\n        </div>\n        <p>" + reason + "</p>\n        <p>Nominated by " + by + ", " + date + "</p>\n        <p>Signed:</p>\n        <div class=\"sig-box\">\n          <div class=\"sig-image\">" + printSig + "</div>\n          <p>Mrs Heather Poustie, Headteacher</p>\n        </div>\n      </div>\n      ";
    return html;
  }

  //called by delete buttons (when children are removed from the db ref)
  function removeOneCommendation(snapshot) {
    var $divToRemove = $("div[data-id=\"" + snapshot.key + "\"]");
    $divToRemove.fadeOut(300, function () {
      $divToRemove.remove();
    });
  }

  //called on logout by change in auth state
  function removeAllCommendations($container) {
    var $allDivs = $container.find('div');
    $allDivs.each(function (index, value) {
      $(value).remove();
    });
  }

  //returns inline svg of logo, supply size in px and colour as #
  function logoTemplate(colour, opacity, size) {
    return "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"" + size + "\" height=\"" + size + "\" viewBox=\"0 0 570 570\"><path d=\"m410.2 12.6c13.4-18.8 2.2 23.7 12.8 17 0.5 10.1-21.3 39.9 1.8 26.6 3.8-21.6 16.9-8.1 7.1 5.5-10.4 25.9-48.5 23.7-56.6 51.2-0.6 16.9 26.3 21.9 35.5 36 11 5.8 38 6.8 24.3 25.4-17.7 8.6-37.8 12.7-39.3 36.8-7.9 19.3-9.4 41.9 0.5 60.5 11.5 19.8-10.9 59.5 23.4 61.6 18.8-5 53.6 0.1 44.7 27.1-13.4 17.9-11.6 43.1-27.6 58.8-9.1 9.6-35.9 24.8-27.4-0.5 1.8-13.5 21-19 14-37.5-1.1-29.4-31.4 5.6-46.2 7.6-20.9 5-42.3 4.7-63.5 6.2-25.7 0.7-52.8-2.6-77.1 7.2-22.3 11.3-30.5 36.9-51.5 49.2-18.6 14.9-51.3 8.7-61.9 32.9 0.2 29.1-11.1 53.9-36 69.5-16.2 17.3-18.1-27.6 0.9-25.1 18.4-14.6 13.6-40.5 16.9-61.1 6.4-24.9 38.3-34.9 40.7-63.1 4.1-18.9-3.1-38.8 2.7-58 4.1-15.6-23.8-34.5 5.4-34.6 11.1 0 13.7 17.6 27 4.6 26.3-6.3 54.1-2 80-10.9 32.9-11.4 61.1-36.6 74.2-69.1 14-26.7 17-58.2 15.5-87.9-18.1-6.1-36.9-55-5.3-40.2 21.1 21.4 6.8-25.2-1.6-33.7-12.4-22.5 8.9-6.1 14.6 4.1 23.5 2.8 21.8-32.5 24.8-48.9 12.1-11.5 5.8 38.6 15.8 14.5 6.7-9.3 10.2-20.5 11.4-31.8z\" fill=\"" + colour + "\" fill-opacity=\"" + opacity + "\"/></svg>";
  }

  function sigTemplate(width) {
    var height = width * 0.3;
    /*
    Old signature...
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 370 110"><path d="m35.1 114c-2.3-0.6-5.1-5.1-3.1-5.1 0.5 0 0.7-0.6 0.4-1.4-0.3-0.8 0.8-4 2.3-7.2 2.9-6 14.7-25.5 18.6-30.9 14.1-19.3 24.8-31.5 27.8-31.5 1 0 2.2 0.9 2.8 2 0.9 1.7 0.1 3.5-5.4 11.8-14 20.8-19.8 28.2-22.5 28.2-1.8 0-9.7 11.9-15 22.6l-3 6.1 5.5-1.9c3.4-1.1 7.5-1.8 10.7-1.6 4.8 0.3 5.2 0.5 5.5 3 0.3 2.5 0 2.8-2.7 2.8-1.7 0-3.3-0.4-3.6-0.9-0.6-1-3.3-0.4-11 2.7-2.9 1.1-6 1.7-7.4 1.3zm35.1-10.7c-2.2-1.5-2.2-1.7-0.6-3.5 2.1-2.3 4.7-2.4 6.4-0.4 1 1.2 0.9 1.9-0.5 3.5-2.2 2.4-2.4 2.4-5.3 0.4zm51.6-8c-3.3-1.7-6.8-6-6.8-8.3 0-4.1 3.6-11.6 7.4-15.6 4.5-4.7 8.5-6.2 12.4-4.9 3.1 1.1 4.1 3.4 1.5 3.4-3.5 0-8.8 4.7-11.6 10.2-2.9 5.8-2.8 8.3 0.5 9.3 3.2 1 13 0.7 16.1-0.5 2.8-1.1 6.7 0 6.7 1.8 0 0.5-3.2 2-7.1 3.5-7.8 2.9-14.8 3.3-19.1 1zm53.6-14.1c-1.9-1.3-2.2-3.7-0.7-5.4 1.4-1.6 1.7-1.6 3.9-0.1 3.2 2.1 3.3 6.3 0.1 6.3-1.2 0-2.7-0.3-3.4-0.7zm37.9-3.4c-3.9-1.1-8.3-7.1-8.3-11.2 0-4.1 6.7-10.7 10.8-10.7 1.7 0 3.3-0.4 3.7-1 2.2-3.5 12.8 4.5 13.9 10.5 0.8 4.2-0.4 6.6-4.9 10.1-3.8 2.9-10 3.9-15.2 2.3zm10.3-6.8c4-2.4 4.9-5.6 2.3-8.2-4-4-12-1.7-13.4 3.8-0.5 2.1-0.2 3.1 1.5 4.5 2.8 2.3 5.7 2.2 9.6-0.1zm29.3-2.6c-1.4-1.4-1.4-2.3-0.2-8.8 1.8-9.4 3.3-10.6 8.3-6.7 3.7 2.9 9.9 5 10 3.3 0.2-4.8 1.5-9.5 3.5-12.6 1.3-2.1 2.4-4.2 2.4-4.7 0-0.6 0.7-1 1.5-1 2.8 0 3.3 3.3 2 12.8-1.6 11.3-2 12.5-4 11.8-0.8-0.3-1.3-0.2-1 0.3 1.1 1.8-1.2 1.9-7 0.5-8.1-1.9-8-2-9 2.3-1 4.2-3.9 5.4-6.5 2.8zm54.6-8.7c-9.3-4.3-12.3-7.1-8.8-8.3 1-0.3 2.7-2.5 3.8-4.8 1.2-2.5 3.4-5 5.3-6.1 3.1-1.8 3.5-1.8 6.8-0.3 4.7 2.2 4.8 6.7 0.2 11.4-2.1 2.2-2.7 3.3-1.7 3.3 2.1 0 10.8-5.7 14.2-9.3 2.3-2.5 3.2-2.9 4.6-2 1.1 0.7 1.6 2.2 1.4 4.2-0.2 2.9 0 3.1 3.1 3.1 7.9 0 20.7-7.6 22.6-13.4 1.4-4.3 4.2-6.8 6.5-6 1.4 0.5 1.6 1.4 1.1 4.8-0.4 2.3-1.1 4.3-1.6 4.4-2.1 0.7-0.9 4.1 1.7 4.8 7 1.8 19.6-4.3 23.3-11.2 1.3-2.4 3.1-5.1 4.2-6 1.8-1.6 2-1.6 3.6-0.1 1.4 1.4 1.5 2.2 0.6 4.9-2.2 6.5-2.4 7.8-1.3 7.8 2.9 0 5.6 5.9 2.7 6.1-2.7 0.2-5.3-0.4-7.1-1.7-1.7-1.2-2.3-1.1-4.7 0.6-7.1 5-19.9 7.2-26.1 4.3-3.7-1.7-3.8-1.7-7.8 1.1-4.2 2.9-12.3 5.5-17.3 5.5-1.6 0-4.2-0.7-5.9-1.6-2.9-1.5-3.2-1.4-6.3 0.9-1.8 1.4-5.5 3.1-8.2 3.9-4.5 1.3-5.3 1.3-8.9-0.4zm-63.5-15.8c0-0.6-0.6-1-1.2-0.9-4.1 0.8-8.7-4.3-5.6-6.3 2.2-1.4 3.8-1 6.4 1.6 2.6 2.6 3.2 5 1.5 6-0.5 0.3-1 0.1-1-0.5zm92.7-30.8c-2.2-2.4-2.1-4.9 0.3-6.1 1.5-0.8 2.4-0.5 4.2 1.3 1.2 1.3 2.4 3.3 2.6 4.5 0.3 1.8-0.2 2.1-2.5 2.1-1.6 0-3.6-0.8-4.5-1.8z"/></svg>`
    */
    return "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"" + width + "\" height=\"" + height + "\" viewBox=\"0 0 140.939 42.324\"><path d=\"M32.864 41.34c-1.06-1.106-1.664-1.352-3.346-1.365-2.007-.015-2.027-.03-.928-.658 1.124-.643 1.812-.74.105-.757-2.05-.02-4.365-1.425-4.79-3.692-.362-1.923-1.024-2.473-5.664-4.7-4.986-2.392-8.865-3.606-12.653-3.957l-3.068-.284-.498 1.3c-.672 1.756.577 5.89 2.565 8.493 2.21 2.892 5.32 4.272 9.627 4.272 4.375 0 16.752-1.2 16.752-.75 0 .672-13.748 2.976-17.448 2.483-5.783-.77-9.867-3.116-12.253-7.745-1.537-2.983-1.698-6.878-.347-8.382.82-.912 1.183-.978 4.06-.737 3.85.322 8.902 1.923 13.735 4.35 1.99 1 3.778 1.718 3.976 1.596.197-.122.492-4.024.656-8.67.163-4.646.498-9.958.745-11.804.47-3.51 1.365-5.127 2.314-4.18.392.393.395 1.497.013 4.48-.28 2.175-.735 7.43-1.013 11.678-.582 8.887-.318 10.46 1.995 11.87 2.17 1.324 2.54 1.14 2.543-1.27.01-6.426 1.29-12.29 4.042-18.547.708-1.608 1.555-3.832 1.883-4.942.395-1.337.883-2.073 1.447-2.18.96-.182.94.284-.32 7.573-.364 2.102-.904 5.643-1.2 7.868-.65 4.892-1.51 8.464-2.663 11.036-1.15 2.567-.856 3.185 1.384 2.903.98-.124 2.774-1.62 3.267-1.884 1.883-1.007 6.92-4.84 4.963-3.46-2.14 1.506-9.458 7.365-8.364 8.81 1.5 1.98.344 3.2-1.518 1.257zm-5.4-5.396c-.152-.248-.367-.45-.476-.45-.11 0-.198.202-.198.45 0 .247.214.45.476.45s.35-.203.198-.45zm6.45-9.443c1.205-5.675 1.414-9.12.454-7.468-1.146 1.97-2.934 11.11-2.357 12.042.523.845.997-.294 1.905-4.573zm92.537 14.357c-2.07-.177-3.712-.608-4.793-1.26-1.535-.927-1.837-.958-4.532-.462-3.285.605-5.098.08-6.005-1.738-.754-1.512-.737-1.51-3.374-.597-3.458 1.195-5.27.834-6.13-1.22-.367-.878-.585-2.297-.485-3.153.143-1.22.006-1.604-.634-1.77-1.12-.293-1.04-.532.636-1.93 1.126-.94 1.607-1.86 2.138-4.08.376-1.578.886-2.867 1.133-2.867.248 0 .51 1.263.584 2.806.126 2.644.205 2.822 1.35 3.062 3.8.793 7.335 2.143 7.778 2.97.77 1.44.24 1.432-2.68-.04-2.812-1.42-5.8-1.82-6.108-.817-.686-.477-1.177 1.902-1.32 3.298-.198 1.923.774 2.4 1.243 2.58 1.03.394 3.836-.442 5.618-1.677.925-.64 1.83-1.164 2.014-1.164.182 0 .284.793.227 1.762-.058.97.16 2.082.486 2.473.733.883 4.93 1.005 5.158.15.082-.31.39-1.574.683-2.81.293-1.236 1.1-2.956 1.793-3.822 1.546-1.932 7.915-4.725 8.623-4.017.342.342-2.094 1.322-4.062 2.658-2.89 1.963-4.51 4.023-4.512 5.743-.002 1.473 1.53 1.318 5.69-.576 3.817-1.74 6.184-3.357 6.92-4.73.406-.758.247-1.018-1.12-1.824-1.948-1.15-4.394-1.454-2.605-1.454 1.557 0 5.512 1.08 5.512 2.422 0 1.263-3.67 5.078-5.733 5.96-.93.396-2.754 1.16-4.053 1.698-4.894 2.022-2.34 3.06 7.862 3.19 4.014.053 7.248.147 7.186.21-.063.062-1.526.352-3.25.643-3.762.634-7 .745-11.237.385zm-49.017-1.865c-.385-.55-.7-1.662-.7-2.473 0-1.235-.165-1.472-1.013-1.456-2.265.043-8.342 1.14-8.93 1.61-1.25 1.003-4.223 2.066-5.346 2.066-1.88 0-.617-.915 1.756-1.62 3.65-1.083 3.925-1.338 4.233-3.94.317-2.673 1.38-4.218 2.123-3.08.242.37.393 1.18.338 1.798-.056.618.054 1.377.245 1.686.505.817 3.248.683 6.554-.322 1.587-.482 3.054-.773 3.26-.646.207.128.072.817-.298 1.533-.37.715-.673 1.816-.673 2.446 0 1.038.17 1.147 1.8 1.147 2.133 0 2.275.425.492 1.477-1.767 1.044-3.002.97-3.842-.228zm12.798.7c-2.383-.376-3.15-.633-3.15-1.058 0-.243.862-.443 1.913-.446 2.917-.008 5.287-.502 5.287-1.102 0-.605-3.043-3.115-4.43-3.553-.494-.156-.557-.35-.98-1.03-.425-.68-2.205-2.283-2.756-2.96l-1-1.232 1.062-1.13c.773-.82 1.528-1.13 2.773-1.13 2.307 0 3.304 1.638 2.893 4.378-.312 2.078.122 2.533 3.02 4.333.692.43 1.484 1.277 1.76 1.883.386.847.958 1.594 2.004 1.1 5.37-2.534 10.14-6.12.49 1.113-5.152 1.17-6.167 1.264-8.886.836zm.45-10.492c0-1.272-.668-1.8-2.285-1.8-1.143 0-1.122 1.353.04 2.6 1.145 1.227 2.246.835 2.246-.8zm-43.535 8.88c-.52-.557-1.16-1.57-1.417-2.25-.257-.68-.798-1.235-1.202-1.235-.526 0 .442-2.094.68-2.658.762-1.814-6.014 2.604-6.75 2.604-.923 0 4.765-3.413 6.203-6.523 1.206-2.61 1.22-2.74 1.14-11.407-.094-10.51.31-13.103 2.37-15.16 2.485-2.485 5.07-1.76 7.305 2.05 1.008 1.72 1.23 2.705 1.37 6.118.143 3.4-.012 4.64-.94 7.535-1.127 3.516-4.06 8.864-7.68 14-.62.88-.762 1.6-.543 2.766.41 2.18 1.12 1.98 1.015-.288-.104-2.28.222-5.01.637-2.932.154.77 1.124 3.56 1.314 3.676.45.28-.215 3.202-.922 4.053-.766.922-1.477.826-2.58-.35zm5.015-16.657c2.492-5.01 3.546-9.735 2.963-13.28-.464-2.822-2.305-6.19-3.61-6.603-1.27-.403-3.063.87-3.84 2.725-.875 2.096-.863 10.482.02 12.59.41.986.626 2.86.58 5.048-.13 6.017.708 5.914 3.887-.48zm3.51 17.224c-4.935-1.167-5.878-6.973-1.522-9.373 2.132-1.175 5.95-2.31 7.8-2.317 1.755-.008 2.848 1.423 2.94 3.203.1 1.995-4.285 7.166-.996.283-.418-1.42-.508-1.466-2.714-1.412-2.8.07-6.158 1.49-7.172 3.038-.712 1.086-.708 1.25.075 2.843.613 1.248 1.304 1.862 2.63 2.343.99.357 7.507.333 7.624.426.224.18-3.71 1.328-4.093 1.26-.122-.02-3.75-.1-4.57-.293zm29.002-2.615c.293-.762 4.87-3.98 5.23-3.617.16.158-3.56 3.528-4.177 4-1.305 1-4.71 3.177-4.007 1.782z\"/></svg>";
  }
});
