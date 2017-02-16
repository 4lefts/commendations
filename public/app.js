//next
//build form -> post data
//install webpack to transpile es6
//css
//propper error handling
//db rules (including chekcing types)

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

    // cache elements for logging in
    const $loginCtrl = $('#login-ctrl')
    const $loginBtn = $loginCtrl.find('button')

    // ...and out
    const $logoutCtrl = $('#logout-ctrl')
    const $logoutBtn = $logoutCtrl.find('button')

    //EVENT LISTENERS//

    //add listener to login button
    $loginBtn.on('click', () => {
      firebase.auth().signInWithPopup(provider).then((result) => {
      }).catch((err) => console.log(err))
    })

    //and logout button
    $logoutBtn.on('click', () => {
      firebase.auth().signOut().then(() => {
      }, (err) => console.log('error:' + err) )
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
         $loginCtrl.addClass('hidden')
         $logoutCtrl.find('span').text(user.displayName)
         $logoutCtrl.removeClass('hidden')
         $commendationsForm.removeClass('hidden')
         console.log(`signed in as ${user.uid}`)
       } else {
         removeAllCommendations($commendationsContainer)
         $logoutCtrl.addClass('hidden')
         $commendationsForm.addClass('hidden')
         $loginCtrl.removeClass('hidden')
         console.log('signed out!')
       }
    })

    function updateDbRef(userId, ref){
      return ref.child(userId)
    }

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
        timestamps: t
      }
      const newKey = ref.push().key
      ref.child(newKey).set(newData)
    }

    function renderCommendation(snapshot){
      const val = snapshot.val()
      const html = `
          <div class="commendation">
            <header>
              <h3>${val.name} - <span>${val.className}</span></h3>
              <h4>${val.date}</h4>
              <button>Print</button>
              <button data-id="${snapshot.key}" class="delete-btn">Delete</button>
            </header>
            <p>${val.reason}</p>
            <p>By ${val.displayName}</p>
          </div>
        `
      $commendationsContainer.prepend(html)
    }

    function removeOneCommendation(snapshot){
      const $idToRemove = $(`button[data-id="${snapshot.key}"]`)
      const $divToRemove = $idToRemove.closest('div')
      $divToRemove.remove()
    }

    function removeAllCommendations($container){
      $container.find('div').remove()
    }

  }())
})
