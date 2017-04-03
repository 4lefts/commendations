'use strict'

$(document).ready(() => {
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

    //db refs
    const commendationsRef = firebase.database().ref().child('commendations')
    const adminsDbRef = firebase.database().ref().child('admins')
    let userRefs = []

    //set initial filter date as the beginning of current academic year
    let filterDate = setInitialFilterDate()
    //helper function to get yyyy-mm-dd string of start of current academic year
    function setInitialFilterDate(cb){
      const tempD = new Date()
      let tempY
      if(tempD.getMonth() < 8){
        tempY = tempD.getFullYear() - 1
      } else {
        tempY = tempD.getFullYear()
      }
      return `${tempY}-09-01`
    }

    //CACHE DOM//
    const $commendationsContainer = $('#commendations-container')

    //form elements
    const $commendationsForm = $('#commendations-form')
    const $name = $('#name')
    const $className = $('#class-name')
    const $reason = $('#reason')
    const $sendButton = $('#send-button')

    //controls for filtering and printing all
    const $controlsForm = $('#controls-form')
    //p element to display the current filter date
    const $since = $('#since')
    renderSinceParagraph(filterDate)

    // cache header for logging in and out
    const $headerContainer =  $('#header-container-outer')

    //EVENT LISTENERS//

    //add listener to login button
    $headerContainer.on('click', '#login-btn', () => {
      firebase.auth().signInWithPopup(provider).then((result) => {}).catch((err) => console.log(err))
    })

    //and logout button
    $headerContainer.on('click', '#logout-btn', () => {
      console.log('logging out!')
      firebase.auth().signOut().then(() => {}, (err) => console.log('error:' + err) )
    })

    //add form listener to send commendation
    $sendButton.on('click', (event) => {
      const usr = firebase.auth().currentUser
      submitCommendation($name.val(), $className.val(), $reason.val(), usr)
      //reset the form
      $(event.target).closest('form').find('input:text, textarea').val('')
      return false
    })

    //print one commendation
    $commendationsContainer.on('click', '.print-btn', (event) => {
      printOneCommendation(event)
    })

    //delete one commendation
    $commendationsContainer.on('click', '.delete-btn', (event) => {
      const $commendationToDelete = $(event.target).closest('.commendation')
      const dataId = $commendationToDelete.attr('data-id')
      const uid = $commendationToDelete.attr('data-owner')
      console.log(`deleting: ${dataId}`)
      commendationsRef.child(uid).child(dataId).remove().then(() => {
        console.log('removed from fb!')
      }).catch((err) => {
        console.log(error)
      })
    })

    $controlsForm.on('click', '#date-filter-button', (event) =>{
      const $dateInput = $(event.target).prev()
      filterDate = $dateInput.val()
      removeAllCommendations($commendationsContainer)
      userRefs.forEach((elem) => {
        attachCommendationListeners(elem, filterDate)
      })
      console.log(`new filter date is: ${filterDate}`)
      $dateInput.val('')
      renderSinceParagraph(filterDate)
      return false
    })

    $controlsForm.on('click', '#print-all-button', (event) => {
      printAllCommendations()
      return false
    })

    //observe changes to auth state
    firebase.auth().onAuthStateChanged((user) => {
      if(user){
        let isAdmin = false
        adminsDbRef.once('value').then((snapshot) => {
          if(snapshot.val().hasOwnProperty(user.uid)){
            isAdmin = true
          } else {
            isAdmin = false
          }
          console.log(`are you an admin?: ${isAdmin}`)
          makeCommendationRefsArray(isAdmin, user.uid, () => {
            userRefs.forEach((elem) => {
              attachCommendationListeners(elem, filterDate)
            })
          })
          if(isAdmin){
            $controlsForm.removeClass('hidden')
            // renderControlsForm($controlsFormContainer)
          } else {
            $controlsForm.addClass('hidden')
            // removeControlsForm($controlsFormContainer)
          }
      })
        $commendationsForm.removeClass('hidden')
      } else {
        removeAllCommendations($commendationsContainer)
        $controlsForm.addClass('hidden')
        $commendationsForm.addClass('hidden')
      }
      renderHeader(user)
    })

    //sort of middleware - creates an array of uids to attach listners to
    function makeCommendationRefsArray(isAd, uid, cb){
      //get firebase to listen for child event on each of the db refs
      //for a normal user, this will be an array with only one element,
      //while admins will get everyone
      const refsArray = []
      //listen for everything (isAdmin == true)
      if(isAd){
        //get all the uid's in the commendations db
        commendationsRef.once('value').then((snapshot) => {
          for(let key in snapshot.val()){
            refsArray.push(key)
          }
          console.log(refsArray)
          userRefs = refsArray
          cb()
        })
      } else { //or listen for specific user
        refsArray.push(uid)
        console.log(refsArray)
        userRefs = refsArray
        cb()
      }
    }

    //listens for child events added/removed from db, not events on the DOM
    function attachCommendationListeners(ref, dateSince){
      //db listeners for child events also query according to date
      const thisChild = commendationsRef.child(ref)
      thisChild.orderByChild('date').startAt(dateSince).on('child_added', (snapshot) => renderCommendation(snapshot))
      thisChild.on('child_removed', (snapshot) => removeOneCommendation(snapshot))
    }

    //called be the submit button
    function submitCommendation(name, className, reason, usr){
      const d = new Date()
      const t = d.getTime()
      const today = makeDateString(d)
      const newData = {
        name: name,
        className: className,
        date: today,
        reason: reason,
        displayName: usr.displayName,
        uid: usr.uid,
        timestamp: t
      }
      const newKey = commendationsRef.child(usr.uid).push().key
      commendationsRef.child(usr.uid).child(newKey).set(newData).then(() => {
        //success pop up here
      }).catch((error) => {
        //error popup here
        console.log(error)
      }) //error handler in here?
    }

    //helper to get date in yyyy-mm-dd format for ordering
    function makeDateString(d){
      const tmp = d.toDateString().split(' ').slice(1)
      const m1 = monthToNumber(tmp[0])
      const m2 = zeroPad(m1)
      const d1 = zeroPad(tmp[1])
      const today = `${tmp[2]}-${m2}-${d1}`
      return today
      function monthToNumber(m){
        //ugly hack to get jan = 1
        const months = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
        //zero pad date
        return months.indexOf(m).toString()
      }
      function zeroPad(s){
        if(s.length == 2){
          return s
        } else {
          return '0' + s
        }
      }
    }

    //called when auth state changes
    function renderHeader(usr){
      if(usr){
        const html = `
        <div id="header-container">
          <div class="header main-header">
            <h1>Decoy School Commendations</h1>
            <button id="logout-btn">Log Out</button>
          </div>
        </div>
        <div id="sub-header-container">
          <div class="header sub-header">
            <p>Logged in as ${usr.displayName}</p>
          </div>
        </div>
        `
        console.log(`signed in as ${usr.uid}`)
        $headerContainer.html(html)
      } else {
        const html = `
        <div id="login-container">
          <div id="login-screen">
            <h3>Weclome to</h3>
            <h1>Decoy Primary Commendations</h1>
            ${logoTemplate('#558B2F', 300)}
            <button id="login-btn">Log In</button>
          </div>
        </div>
        `
        console.log('signed out!')
        $headerContainer.html(html)
      }
    }

    //renders paragraph in controls form to show date filtered since
    //called by initial setup and by filter button
    function renderSinceParagraph(d){
      $since.text(`(Currently displaying commendations made since ${d})`)
    }

    //called when children are added to db reference
    function renderCommendation(snapshot){
      const val = snapshot.val()
      const html = `
      <div class="commendation" data-id="${snapshot.key}" data-owner="${val.uid}">
        <div class="header commendation-header">
          <h3><span class="commendation-name">${val.name}</span> - <span class="commendation-class">${val.className}</span> - <span class="commendation-date">(${val.date})</span></h3>
          <div>
            <button class="print-btn">Print</button>
            <button class="delete-btn">Delete</button>
          </div>
        </div>
        <p class="commendation-reason">${val.reason}</p>
        <p class="commendation-by">By ${val.displayName}</p>
      </div>
      `
      $commendationsContainer.prepend(html)
    }

    //called by the print buttons
    function printOneCommendation(event){
      //cache elements from commendation to print
      const $currentCommendation = $(event.target).closest('.commendation')
      const id = $currentCommendation.attr('data-id')
      //format name and class
      const name = $currentCommendation.find('.commendation-name').html()
      const schoolClass = $currentCommendation.find('.commendation-class').html()
      //slice brackets off date
      const date = $currentCommendation.find('.commendation-date').html().slice(1, -1)
      //get reason and author
      const reason = $currentCommendation.find('.commendation-reason').html()
      //slice off the word 'by'
      const by = $currentCommendation.find('.commendation-by').html().slice(2)
      const printLogo = logoTemplate('#000000', 100)
      //render template
      const html = `
      <div class="printing" id="printing-${id}">
        <div class="banner">
          <div class="logo-left">${printLogo}</div>
          <h2>Decoy Community Primary School</h2>
          <h2>Certificate of Commendation</h2>
          <div class="logo-right">${printLogo}</div>
          <p>This certificate is awarded to</p>
          <h1>${name}</h1>
          <p>in ${schoolClass}</p>
        </div>
        <p>For ${reason}</p>
        <p>Nominated by ${by}, ${date}</p>
        <p>Signed:</p>
        <div class="sig-box">
          <img src="./images/sig-temp.png">
          <p>Mrs G O'Neill, headteacher</p>
        </div>
      </div>
      `
      $commendationsContainer.append(html)
      //set timeout is a hack to make sure imgs in the printed template are
      //loaded. can be removed once inline svgs are in place.
      setTimeout(() => {
        window.print()
        $('.printing').remove()
      }, 250)
    }

    //called by the print buttons
    function printAllCommendations(event){
      let html = ''
      $('.commendation').each((index, value) => {
        const $curCommendation = $(value)
        const name = $curCommendation.find('.commendation-name').html()
        const schoolClass = $curCommendation.find('.commendation-class').html()
        //slice off brackets:
        const date = $curCommendation.find('.commendation-date').html().slice(1, -1)
        const reason = $curCommendation.find('.commendation-reason').html()
        //slice off word 'by':
        const by = $curCommendation.find('.commendation-by').html().slice(2)
        const printLogo = logoTemplate('#000000', 100)
        const templateHtml = `
        <div class="printing">
         <div class="banner">
           <div class="logo-left">${printLogo}</div>
             <h2>Decoy Community Primary School</h2>
             <h2>Certificate of Commendation</h2>
           <div class="logo-right">${printLogo}</div>
           <p>This certificate is awarded to</p>
           <h1>${name}</h1>
           <p>in ${schoolClass}</p>
         </div>
           <p>For ${reason}</p>
           <p>Nominated by ${by}, ${date}</p>
           <p>Signed:</p>
         <div class="sig-box">
           <img src="./images/sig-temp.png">
           <p>Mrs G O'Neill, headteacher</p>
         </div>
        </div>
        `
        html += templateHtml
      })
      $commendationsContainer.append(html)
      //set timeout is a hack to make sure imgs in the printed template are
      //loaded. can be removed once inline svgs are in place.
      setTimeout(() => {
        window.print()
        $('.printing').remove()
      }, 250)
    }

    //called by delete buttons (when children are removed from the db ref)
    function removeOneCommendation(snapshot){
      const $divToRemove = $(`div[data-id="${snapshot.key}"]`)
      $divToRemove.slideUp(300, () => {
        $divToRemove.remove()
      })
    }
    //blah

    //called on logout by change in auth state
    function removeAllCommendations($container){
      const $allDivs = $container.find('div')
      $allDivs.each((index, value) => {
        $(value).remove()
        console.log('removing!')
      })
    }

    //returns inline svg of logo, supply size in px and colour as #
    function logoTemplate(colour, size){
      return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 570 570"><path d="m410.2 12.6c13.4-18.8 2.2 23.7 12.8 17 0.5 10.1-21.3 39.9 1.8 26.6 3.8-21.6 16.9-8.1 7.1 5.5-10.4 25.9-48.5 23.7-56.6 51.2-0.6 16.9 26.3 21.9 35.5 36 11 5.8 38 6.8 24.3 25.4-17.7 8.6-37.8 12.7-39.3 36.8-7.9 19.3-9.4 41.9 0.5 60.5 11.5 19.8-10.9 59.5 23.4 61.6 18.8-5 53.6 0.1 44.7 27.1-13.4 17.9-11.6 43.1-27.6 58.8-9.1 9.6-35.9 24.8-27.4-0.5 1.8-13.5 21-19 14-37.5-1.1-29.4-31.4 5.6-46.2 7.6-20.9 5-42.3 4.7-63.5 6.2-25.7 0.7-52.8-2.6-77.1 7.2-22.3 11.3-30.5 36.9-51.5 49.2-18.6 14.9-51.3 8.7-61.9 32.9 0.2 29.1-11.1 53.9-36 69.5-16.2 17.3-18.1-27.6 0.9-25.1 18.4-14.6 13.6-40.5 16.9-61.1 6.4-24.9 38.3-34.9 40.7-63.1 4.1-18.9-3.1-38.8 2.7-58 4.1-15.6-23.8-34.5 5.4-34.6 11.1 0 13.7 17.6 27 4.6 26.3-6.3 54.1-2 80-10.9 32.9-11.4 61.1-36.6 74.2-69.1 14-26.7 17-58.2 15.5-87.9-18.1-6.1-36.9-55-5.3-40.2 21.1 21.4 6.8-25.2-1.6-33.7-12.4-22.5 8.9-6.1 14.6 4.1 23.5 2.8 21.8-32.5 24.8-48.9 12.1-11.5 5.8 38.6 15.8 14.5 6.7-9.3 10.2-20.5 11.4-31.8z" fill="${colour}"/></svg>`
    }

  }())
})
