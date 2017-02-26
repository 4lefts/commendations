'use strict'

$(document).ready(function(){
  (function(){
    // Initialize Firebase
    const config = {
      apiKey: "AIzaSyDl-Ep3w5gJIwUA1ZQ7syUmW1DZ6fV2EhI",
      authDomain: "commendations01.firebaseapp.com",
      databaseURL: "https://commendations01.firebaseio.com",
      storageBucket: "commendations01.appspot.com",
      messagingSenderId: "856242512076"
    }
    firebase.initializeApp(config)

    //auth
    const provider = new firebase.auth.GoogleAuthProvider()

    //db variables
    let dbRef = firebase.database().ref().child('commendations')
    let userDbRef

    //CACHE DOM//

    const $commendationsContainer = $('#commendations-container')

    //form elements
    const $commendationsForm = $('#commendations-form')
    const $name = $('#name')
    const $className = $('#class-name')
    const $reason = $('#reason')
    const $sendButton = $('#send-button')

    // cache header for logging in and out
    const $headerContainer =  $('#header-container')

    //EVENT LISTENERS//

    //add listener to login button
    $headerContainer.on('click', '#login-btn', () => {
      firebase.auth().signInWithPopup(provider).then((result) => {}).catch((err) => console.log(err))
    })

    //and logout button
    $headerContainer.on('click', '#logout-btn', () => {
      console.log('trying to logout')
      firebase.auth().signOut().then(() => {}, (err) => console.log('error:' + err) )
    })

    //add form listener
    $sendButton.on('click', () => {
      const usr = firebase.auth().currentUser
      const ref = userDbRef
      submitCommendation($name.val(), $className.val(), $reason.val(), usr, ref)
    })

    //delete one commendation
    $commendationsContainer.on('click', '.delete-btn', (event) => {
      const dataId = $(event.target).attr('data-id')
      console.log(`deleting: ${dataId}`)
      userDbRef.child(dataId).remove().then(() => {
        console.log('removed from fb!')
      }).catch((err) => {
        console.log(error)
      })
    })

    //observe changes to auth state
    firebase.auth().onAuthStateChanged((user) => {
      if(user){
        userDbRef = updateDbRef(user.uid, dbRef)
        attachCommendationListeners(userDbRef)
        $commendationsForm.removeClass('hidden')
      } else {
        removeAllCommendations($commendationsContainer)
        $commendationsForm.addClass('hidden')
      }
      renderHeader(user)
    })

    function updateDbRef(userId, ref){
      return ref.child(userId)
    }

    //listens for child events added/removed from db, not events on the DOM
    function attachCommendationListeners(ref){
      ref.on('child_added', (snapshot) => renderCommendation(snapshot))
      ref.on('child_removed', (snapshot) => removeOneCommendation(snapshot))
    }

    function submitCommendation(name, className, reason, usr, ref){
      const d = new Date()
      const t = d.getTime()
      const today = d.toLocaleDateString('en-GB')
      const newData = {
        name: name,
        className: className,
        date: today,
        reason: reason,
        displayName: usr.displayName,
        uid: usr.uid,
        timestamp: t
      }
      const newKey = ref.push().key
      ref.child(newKey).set(newData)
    }

    function renderHeader(usr){
      if(usr){
        const html = `
        <div class="header main-header">
          <h1>Decoy School Commendations</h1>
          <button id="logout-btn">Log Out</button>
        </div>
        <div class="header sub-header">
          <p>Logged in as ${usr.displayName}</p>
        </div>
        `
        console.log(`signed in as ${usr.uid}`)
        $headerContainer.html(html)
      } else {
        const html = `
        <div  class="header">
          <h1>Decoy School Commendations</h1>
          <button id="login-btn">Log In</button>
        </div>
        <div class="header sub-header">
          <p>Not logged in</p>
        </div>
        `
        console.log('signed out!')
        $headerContainer.html(html)
      }
    }

    function renderCommendation(snapshot){
      const val = snapshot.val()
      const html = `
      <div class="commendation">
      <div class="header commendation-header">
      <h3>${val.name} - <span>${val.className}</span> - <span>(${val.date})</span></h3>
      <div>
      <button>Print</button>
      <button data-id="${snapshot.key}" class="delete-btn">Delete</button>
      </div>
      </div>
      <p>${val.reason}</p>
      <p>By ${val.displayName}</p>
      </div>
      `
      $commendationsContainer.prepend(html)
    }

    //called by delete buttons
    function removeOneCommendation(snapshot){
      const $idToRemove = $(`button[data-id="${snapshot.key}"]`)
      const $divToRemove = $idToRemove.closest('.commendation')
      $divToRemove.slideUp(300, () => {$(this).remove()})
    }

    //callend on logout
    function removeAllCommendations($container){
      $container.find('div').remove()
    }

  }())
})
