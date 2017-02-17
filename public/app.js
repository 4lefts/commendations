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

    // cache elements for logging in
    var $loginCtrl = $('#login-ctrl');
    var $loginBtn = $loginCtrl.find('button');

    // ...and out
    var $logoutCtrl = $('#logout-ctrl');
    var $logoutBtn = $logoutCtrl.find('button');

    //EVENT LISTENERS//

    //add listener to login button
    $loginBtn.on('click', function () {
      firebase.auth().signInWithPopup(provider).then(function (result) {}).catch(function (err) {
        return console.log(err);
      });
    });

    //and logout button
    $logoutBtn.on('click', function () {
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

    //delete one commendation
    $commendationsContainer.on('click', '.delete-btn', function (event) {
      var dataId = $(event.target).attr('data-id');
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
        $loginCtrl.addClass('hidden');
        var names = user.displayName.split(' ');
        $logoutCtrl.find('span').text("" + names[0]);
        $logoutCtrl.removeClass('hidden');
        $commendationsForm.removeClass('hidden');
        console.log("signed in as " + user.uid);
      } else {
        removeAllCommendations($commendationsContainer);
        $logoutCtrl.addClass('hidden');
        $commendationsForm.addClass('hidden');
        $loginCtrl.removeClass('hidden');
        console.log('signed out!');
      }
    });

    function updateDbRef(userId, ref) {
      return ref.child(userId);
    }

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
      ref.child(newKey).set(newData);
    }

    function renderCommendation(snapshot) {
      var val = snapshot.val();
      var html = "\n          <div class=\"commendation\">\n            <div class=\"header commendation-header\">\n              <h3>" + val.name + " - <span>" + val.className + "</span> - <span>(" + val.date + ")</span></h3>\n              <div>\n                <button>Print</button>\n                <button data-id=\"" + snapshot.key + "\" class=\"delete-btn\">Delete</button>\n              </div>\n            </div>\n            <p>" + val.reason + "</p>\n            <p>By " + val.displayName + "</p>\n          </div>\n        ";
      $commendationsContainer.prepend(html);
    }

    function removeOneCommendation(snapshot) {
      var $idToRemove = $("button[data-id=\"" + snapshot.key + "\"]");
      var $divToRemove = $idToRemove.closest('.commendation');
      $divToRemove.remove();
    }

    function removeAllCommendations($container) {
      $container.find('div').remove();
    }
  })();
});