'use strict'

$(document).ready(() => {

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
    const initialFilterDate = setInitialFilterDate()
    let filterDate = initialFilterDate
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
    //jquery ui date picker
    const $dateInput = $('#date-filter').datepicker({
      dateFormat: 'yy-mm-dd',
      minDate: new Date(initialFilterDate),
      maxDate: 0, //stop date filter control from setting date in future
    })
    // $('#date-filter').attr('max', today)
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
      const conf = renderDeleteModal(uid, dataId)
      return false
    })

    //handle confirm and cancel buttons for deleting modal
    $('body').on('click', '#confirm-delete-button', (event) => {
      const $thisBtn = $(event.target)
      const dataId = $thisBtn.attr('data-id')
      const uid = $thisBtn.attr('data-uid')
      deleteCommendation(uid, dataId)
      $thisBtn.closest('.modal-container').remove()
    })

    $('body').on('click', '#cancel-delete-button', (event) => {
      $(event.target).closest('.modal-container').remove()
    })

    function deleteCommendation(u, d){
      console.log(`deleting: ${d}`)
      commendationsRef.child(u).child(d).remove().then(() => {
        console.log('removed from backend!')
      }).catch((err) => {
        console.log(error)
      })
    }

    $controlsForm.on('click', '#date-filter-button', (event) =>{
      filterDate = $dateInput.val() || initialFilterDate
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
      if(user && checkEmail(user.email)){ //if this person is a decoy member of staff
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
          } else {
            $controlsForm.addClass('hidden')
          }
        })
        renderHeader(user)
        $commendationsForm.removeClass('hidden')
      }
      else if(user && !checkEmail(user.email)) { // if not a member of staff
        renderInvalidUserHeader()
        setTimeout(() => {
          firebase.auth().signOut().then(() => {}, (err) => console.log('error:' + err) )
        }, 3000)
        console.log('not a valid user')
      }
      else if (!user) { // if not user (if signed out)
        removeAllCommendations($commendationsContainer)
        $controlsForm.addClass('hidden')
        $commendationsForm.addClass('hidden')
        renderHeader(user)
      }
    })

    function checkEmail(address){
      return /^[^0-9]+@decoyschool.co.uk$/.test(address)
    }

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
      if(usr && checkEmail(usr.email)){
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
            ${logoTemplate('#ffffff', '0.5', 300)}
            <button id="login-btn">Log In</button>
          </div>
        </div>
        `
        $headerContainer.html(html)
      }
    }

    function renderInvalidUserHeader(){
      const html = `
      <div id="login-container">
        <div id="login-screen">
          <h3>Sorry, not a valid user</h3>
          <h3>You must use a Decoy School staff user account</h3>
          ${logoTemplate('#ffffff', '0.5', 300)}
        </div>
      </div>
      `
      $headerContainer.html(html)
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

    //called by clicking on individual delete buttons
    function renderDeleteModal(u, d){
      const html = `
        <div class="modal-container">
          <div class="modal-body">
            <h3>Do you really want to delete this commendation?</h3>
            <div>
              <button type="button" id="confirm-delete-button" data-uid="${u}" data-id="${d}">Yes</button>
              <button type="button" id="cancel-delete-button">No</button>
            </div>
          </div>
        </div>
      `
      $('body').append(html)
    }

    //called by the print buttons
    function printOneCommendation(event){
      const $currentCommendation = $(event.target).closest('.commendation')
      const html = renderPrintCommendation($currentCommendation)
      $commendationsContainer.append(html)
      window.print()
      $('.printing').remove()
    }

    //called by the print buttons
    function printAllCommendations(event){
      let html = ''
      $('.commendation').each((index, value) => {
        const $curCommendation = $(value)

        html += renderPrintCommendation($curCommendation)
      })
      $commendationsContainer.append(html)
      window.print()
      $('.printing').remove()
    }

    //renders an html template of the commendation to print
    function renderPrintCommendation($commendation){
      //cache elements from commendation to print
      const id = $commendation.attr('data-id')
      //format name and class
      const name = $commendation.find('.commendation-name').html()
      const schoolClass = $commendation.find('.commendation-class').html()
      //slice brackets off date and reverse
      const date = $commendation.find('.commendation-date').html()
                                        .slice(1, -1)
                                        .split('-')
                                        .reverse()
                                        .join('/')
      //get reason and author
      const reason = $commendation.find('.commendation-reason').html()
      //slice off the word 'by'
      const by = $commendation.find('.commendation-by').html().slice(2)
      const printLogo = logoTemplate('#000000', '1', 100)
      const printSig = sigTemplate(120)
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
          <div class="sig-image">${printSig}</div>
          <p>Mrs G O'Neill, headteacher</p>
        </div>
      </div>
      `
      return html
    }

    //called by delete buttons (when children are removed from the db ref)
    function removeOneCommendation(snapshot){
      const $divToRemove = $(`div[data-id="${snapshot.key}"]`)
      $divToRemove.slideUp(300, () => {
        $divToRemove.remove()
      })
    }

    //called on logout by change in auth state
    function removeAllCommendations($container){
      const $allDivs = $container.find('div')
      $allDivs.each((index, value) => {
        $(value).remove()
        console.log('removing!')
      })
    }

    //returns inline svg of logo, supply size in px and colour as #
    function logoTemplate(colour, opacity, size){
      return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 570 570"><path d="m410.2 12.6c13.4-18.8 2.2 23.7 12.8 17 0.5 10.1-21.3 39.9 1.8 26.6 3.8-21.6 16.9-8.1 7.1 5.5-10.4 25.9-48.5 23.7-56.6 51.2-0.6 16.9 26.3 21.9 35.5 36 11 5.8 38 6.8 24.3 25.4-17.7 8.6-37.8 12.7-39.3 36.8-7.9 19.3-9.4 41.9 0.5 60.5 11.5 19.8-10.9 59.5 23.4 61.6 18.8-5 53.6 0.1 44.7 27.1-13.4 17.9-11.6 43.1-27.6 58.8-9.1 9.6-35.9 24.8-27.4-0.5 1.8-13.5 21-19 14-37.5-1.1-29.4-31.4 5.6-46.2 7.6-20.9 5-42.3 4.7-63.5 6.2-25.7 0.7-52.8-2.6-77.1 7.2-22.3 11.3-30.5 36.9-51.5 49.2-18.6 14.9-51.3 8.7-61.9 32.9 0.2 29.1-11.1 53.9-36 69.5-16.2 17.3-18.1-27.6 0.9-25.1 18.4-14.6 13.6-40.5 16.9-61.1 6.4-24.9 38.3-34.9 40.7-63.1 4.1-18.9-3.1-38.8 2.7-58 4.1-15.6-23.8-34.5 5.4-34.6 11.1 0 13.7 17.6 27 4.6 26.3-6.3 54.1-2 80-10.9 32.9-11.4 61.1-36.6 74.2-69.1 14-26.7 17-58.2 15.5-87.9-18.1-6.1-36.9-55-5.3-40.2 21.1 21.4 6.8-25.2-1.6-33.7-12.4-22.5 8.9-6.1 14.6 4.1 23.5 2.8 21.8-32.5 24.8-48.9 12.1-11.5 5.8 38.6 15.8 14.5 6.7-9.3 10.2-20.5 11.4-31.8z" fill="${colour}" fill-opacity="${opacity}"/></svg>`
    }

    function sigTemplate(width){
      const height = width * 0.3
      return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 370 110"><path d="m35.1 114c-2.3-0.6-5.1-5.1-3.1-5.1 0.5 0 0.7-0.6 0.4-1.4-0.3-0.8 0.8-4 2.3-7.2 2.9-6 14.7-25.5 18.6-30.9 14.1-19.3 24.8-31.5 27.8-31.5 1 0 2.2 0.9 2.8 2 0.9 1.7 0.1 3.5-5.4 11.8-14 20.8-19.8 28.2-22.5 28.2-1.8 0-9.7 11.9-15 22.6l-3 6.1 5.5-1.9c3.4-1.1 7.5-1.8 10.7-1.6 4.8 0.3 5.2 0.5 5.5 3 0.3 2.5 0 2.8-2.7 2.8-1.7 0-3.3-0.4-3.6-0.9-0.6-1-3.3-0.4-11 2.7-2.9 1.1-6 1.7-7.4 1.3zm35.1-10.7c-2.2-1.5-2.2-1.7-0.6-3.5 2.1-2.3 4.7-2.4 6.4-0.4 1 1.2 0.9 1.9-0.5 3.5-2.2 2.4-2.4 2.4-5.3 0.4zm51.6-8c-3.3-1.7-6.8-6-6.8-8.3 0-4.1 3.6-11.6 7.4-15.6 4.5-4.7 8.5-6.2 12.4-4.9 3.1 1.1 4.1 3.4 1.5 3.4-3.5 0-8.8 4.7-11.6 10.2-2.9 5.8-2.8 8.3 0.5 9.3 3.2 1 13 0.7 16.1-0.5 2.8-1.1 6.7 0 6.7 1.8 0 0.5-3.2 2-7.1 3.5-7.8 2.9-14.8 3.3-19.1 1zm53.6-14.1c-1.9-1.3-2.2-3.7-0.7-5.4 1.4-1.6 1.7-1.6 3.9-0.1 3.2 2.1 3.3 6.3 0.1 6.3-1.2 0-2.7-0.3-3.4-0.7zm37.9-3.4c-3.9-1.1-8.3-7.1-8.3-11.2 0-4.1 6.7-10.7 10.8-10.7 1.7 0 3.3-0.4 3.7-1 2.2-3.5 12.8 4.5 13.9 10.5 0.8 4.2-0.4 6.6-4.9 10.1-3.8 2.9-10 3.9-15.2 2.3zm10.3-6.8c4-2.4 4.9-5.6 2.3-8.2-4-4-12-1.7-13.4 3.8-0.5 2.1-0.2 3.1 1.5 4.5 2.8 2.3 5.7 2.2 9.6-0.1zm29.3-2.6c-1.4-1.4-1.4-2.3-0.2-8.8 1.8-9.4 3.3-10.6 8.3-6.7 3.7 2.9 9.9 5 10 3.3 0.2-4.8 1.5-9.5 3.5-12.6 1.3-2.1 2.4-4.2 2.4-4.7 0-0.6 0.7-1 1.5-1 2.8 0 3.3 3.3 2 12.8-1.6 11.3-2 12.5-4 11.8-0.8-0.3-1.3-0.2-1 0.3 1.1 1.8-1.2 1.9-7 0.5-8.1-1.9-8-2-9 2.3-1 4.2-3.9 5.4-6.5 2.8zm54.6-8.7c-9.3-4.3-12.3-7.1-8.8-8.3 1-0.3 2.7-2.5 3.8-4.8 1.2-2.5 3.4-5 5.3-6.1 3.1-1.8 3.5-1.8 6.8-0.3 4.7 2.2 4.8 6.7 0.2 11.4-2.1 2.2-2.7 3.3-1.7 3.3 2.1 0 10.8-5.7 14.2-9.3 2.3-2.5 3.2-2.9 4.6-2 1.1 0.7 1.6 2.2 1.4 4.2-0.2 2.9 0 3.1 3.1 3.1 7.9 0 20.7-7.6 22.6-13.4 1.4-4.3 4.2-6.8 6.5-6 1.4 0.5 1.6 1.4 1.1 4.8-0.4 2.3-1.1 4.3-1.6 4.4-2.1 0.7-0.9 4.1 1.7 4.8 7 1.8 19.6-4.3 23.3-11.2 1.3-2.4 3.1-5.1 4.2-6 1.8-1.6 2-1.6 3.6-0.1 1.4 1.4 1.5 2.2 0.6 4.9-2.2 6.5-2.4 7.8-1.3 7.8 2.9 0 5.6 5.9 2.7 6.1-2.7 0.2-5.3-0.4-7.1-1.7-1.7-1.2-2.3-1.1-4.7 0.6-7.1 5-19.9 7.2-26.1 4.3-3.7-1.7-3.8-1.7-7.8 1.1-4.2 2.9-12.3 5.5-17.3 5.5-1.6 0-4.2-0.7-5.9-1.6-2.9-1.5-3.2-1.4-6.3 0.9-1.8 1.4-5.5 3.1-8.2 3.9-4.5 1.3-5.3 1.3-8.9-0.4zm-63.5-15.8c0-0.6-0.6-1-1.2-0.9-4.1 0.8-8.7-4.3-5.6-6.3 2.2-1.4 3.8-1 6.4 1.6 2.6 2.6 3.2 5 1.5 6-0.5 0.3-1 0.1-1-0.5zm92.7-30.8c-2.2-2.4-2.1-4.9 0.3-6.1 1.5-0.8 2.4-0.5 4.2 1.3 1.2 1.3 2.4 3.3 2.6 4.5 0.3 1.8-0.2 2.1-2.5 2.1-1.6 0-3.6-0.8-4.5-1.8z"/></svg>`
    }
})
