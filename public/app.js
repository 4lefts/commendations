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

    //db variables
    var dbRef = firebase.database().ref().child('commendations');
    var userDbRef = void 0;

    //CACHE DOM//

    var $commendationsContainer = $('#commendations-container');

    //form elements
    var $commendationsForm = $('#commendations-form');
    var $name = $('#name');
    var $className = $('#class-name');
    var $reason = $('#reason');
    var $sendButton = $('#send-button');

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
      console.log('trying to logout');
      firebase.auth().signOut().then(function () {}, function (err) {
        return console.log('error:' + err);
      });
    });

    //add form listener
    $sendButton.on('click', function () {
      var usr = firebase.auth().currentUser;
      var ref = userDbRef;
      submitCommendation($name.val(), $className.val(), $reason.val(), usr, ref);
    });

    //print one commendation
    $commendationsContainer.on('click', '.print-btn', function (event) {
      printOneCommendation(event);
    });

    //delete one commendation
    $commendationsContainer.on('click', '.delete-btn', function (event) {
      var dataId = $(event.target).closest('.commendation').attr('data-id');
      console.log("deleting: " + dataId);
      userDbRef.child(dataId).remove().then(function () {
        console.log('removed from fb!');
      }).catch(function (err) {
        console.log(error);
      });
    });

    //observe changes to auth state
    firebase.auth().onAuthStateChanged(function (user) {
      if (user) {
        userDbRef = updateDbRef(user.uid, dbRef);
        attachCommendationListeners(userDbRef);
        $commendationsForm.removeClass('hidden');
      } else {
        removeAllCommendations($commendationsContainer);
        $commendationsForm.addClass('hidden');
      }
      renderHeader(user);
    });

    function updateDbRef(userId, ref) {
      return ref.child(userId);
    }

    //listens for child events added/removed from db, not events on the DOM
    function attachCommendationListeners(ref) {
      ref.on('child_added', function (snapshot) {
        return renderCommendation(snapshot);
      });
      ref.on('child_removed', function (snapshot) {
        return removeOneCommendation(snapshot);
      });
    }

    function submitCommendation(name, className, reason, usr, ref) {
      var d = new Date();
      var t = d.getTime();
      var today = d.toLocaleDateString('en-GB');
      var newData = {
        name: name,
        className: className,
        date: today,
        reason: reason,
        displayName: usr.displayName,
        uid: usr.uid,
        timestamp: t
      };
      var newKey = ref.push().key;
      ref.child(newKey).set(newData); //error handler in here?
    }

    function renderHeader(usr) {
      if (usr) {
        var html = "\n        <div id=\"header-container\">\n          <div class=\"header main-header\">\n            <h1>Decoy School Commendations</h1>\n            <button id=\"logout-btn\">Log Out</button>\n          </div>\n        </div>\n        <div id=\"sub-header-container\">\n          <div class=\"header sub-header\">\n            <p>Logged in as " + usr.displayName + "</p>\n          </div>\n        </div>\n        ";
        console.log("signed in as " + usr.uid);
        $headerContainer.html(html);
      } else {
        var _html = "\n        <div id=\"header-container\">\n          <div  class=\"header\">\n            <h1>Decoy School Commendations</h1>\n            <button id=\"login-btn\">Log In</button>\n          </div>\n        </div>\n        <div id=\"sub-header-container\">\n          <div class=\"header sub-header logged-out\">\n            <p>Not logged in</p>\n          </div>\n        </div>\n        ";
        console.log('signed out!');
        $headerContainer.html(_html);
      }
    }

    function renderCommendation(snapshot) {
      var val = snapshot.val();
      var html = "\n      <div class=\"commendation\" data-id=\"" + snapshot.key + "\">\n        <div class=\"header commendation-header\">\n          <h3><span class=\"commendation-name\">" + val.name + "</span> - <span class=\"commendation-class\">" + val.className + "</span> - <span class=\"commendation-date\">(" + val.date + ")</span></h3>\n          <div>\n            <button class=\"print-btn\">Print</button>\n            <button class=\"delete-btn\">Delete</button>\n          </div>\n        </div>\n        <p class=\"commendation-reason\">" + val.reason + "</p>\n        <p class=\"commendation-by\">By " + val.displayName + "</p>\n      </div>\n      ";
      $commendationsContainer.prepend(html);
    }

    //called by the print buttons
    function printOneCommendation(event) {
      //cache elements from commendation to print
      var $currentCommendation = $(event.target).closest('.commendation');
      //format name and class
      var name = $currentCommendation.find('.commendation-name').html();
      var schoolClass = $currentCommendation.find('.commendation-class').html();
      //slice brackets off date
      var date = $currentCommendation.find('.commendation-date').html().slice(1, -1);
      //get reason and author
      var reason = $currentCommendation.find('.commendation-reason').html();
      //slice off the word 'by'
      var by = $currentCommendation.find('.commendation-by').html().slice(2);
      //render template
      var html = "\n      <div class=\"printing\">\n        <div class=\"banner\">\n          <h2>Decoy Community Primary School</h2>\n          <h1>Certificate of Commendation</h1>\n        </div>\n        <p>This certificate is awarded to</p>\n        <h1>" + name + "</h1>\n        <h2>in " + schoolClass + "</h2>\n        <p>For " + reason + "</p>\n        <p>Nominated by " + by + ", " + date + "</p>\n        <p>Signed:</p>\n        <p>Mrs G O'Neill, headteacher</p>\n      </div>\n      ";
      $commendationsContainer.append(html);
      window.print();
      $('.printing').remove();
    }

    //called by delete buttons
    function removeOneCommendation(snapshot) {
      var _this = this;

      var $divToRemove = $("div[data-id=\"" + snapshot.key + "\"]");
      $divToRemove.slideUp(300, function () {
        $(_this).remove();
      });
    }

    //callend on logout
    function removeAllCommendations($container) {
      $container.find('div').remove();
    }
  })();
});