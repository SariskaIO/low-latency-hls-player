function generateRandomString(length) {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';

    for (let i = 0; i < length; i++) {
        const randomIndex = Math.floor(Math.random() * characters.length);
        result += characters.charAt(randomIndex);
    }

    return result;
}

async function startChatApp(channelName) {
    console.log("start chat app", channelName);    
    let Socket  = window.Phoenix.Socket;
    // And connect to the path in "lib/chat_web/endpoint.ex". We pass the
    // token for authentication. Read below how it should be used.
    const getToken = async () => {
        // Check if token exists in session storage
        const storedToken = sessionStorage.getItem('token');
        if (storedToken) {
            return storedToken;
        }
        
        // Token doesn't exist in session storage, fetch a new one
        const body = {
            method: "POST",
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                apiKey: "249202aabed00b41363794b526eee6927bd35cbc9bac36cd3edcaa",
                user: {
                    id: generateRandomString(),
                    name: generateRandomString(),
                    email: "nick@gmail.com",
                    avatar: "https://test.com/user/profile.jpg",
                    moderator: true
                }
            })
        };
    
        try {
            const response = await fetch("https://api.sariska.io/api/v1/misc/generate-token", body);
            if (response.ok) {
                const json = await response.json();
                const token = json.token;
                
                // Store token in session storage
                sessionStorage.setItem('token', token);
                
                return token;
            } else {
                console.log(response.status);
            }
        } catch (error) {
            console.log('error', error);
        }
    };
    console.log({token:  await getToken()})
    let socket = new Socket("ws:/localhost:4000/api/v1/messaging/websocket", {params: { token:  await getToken()}});

    // Connect to the socket:
    socket.onOpen = () => {
        console.log("Socket opened", socket);
    };
    // Handles socket closing event
    socket.onClose = () => {
        console.log("Connection dropped");
    };
    // Handles socket error events
    socket.onError = (error) => {
        console.log("Socket error", error);
        console.error("There was an error with the connection");
    };
    
    // Open connection to the server
    socket.connect();
    
    // Show progress bar on live navigation and form submits
    window.addEventListener("phx:page-loading-start", info => topbar.delayedShow(200));
    window.addEventListener("phx:page-loading-stop", info => topbar.hide());

    /* INITIAL SETUP OF VARIABLES AND JOINING CHANNEL -------------- */
    const ul = document.getElementById('msg-list');                       // list of messages.
    const name = document.getElementById('name');                         // name of message sender
    const msg = document.getElementById('msg');                           // message input field
    const send = document.getElementById('send');                         // send button
    const peopleListMobile = document.getElementById('people_online-list-mobile');      // online people list mobile
    const peopleListDesktop = document.getElementById('people_online-list-desktop');      // online people list desktop

    let channel = socket.channel(`chat:${channelName.toLowerCase()}`); // connect to chat "

    /* ONLINE people / PRESENCE FUNCTIONS -------------- */
    // This function will be probably caught when the person first enters the page
    channel.on('presence_state', function (payload) {
        // Array of objects with id and username
        const currentlyOnlinePeople = Object.entries(payload).map(elem => ({username: elem[0], id: elem[1].metas[0].phx_ref}));
            
        updateOnlinePeopleList(currentlyOnlinePeople);
    });
    // Listening to presence events whenever a person leaves or joins
    channel.on('presence_diff', function (payload) {
        if(payload.joins && payload.leaves) {
            // Array of objects with id and username
            const currentlyOnlinePeople = Object.entries(payload.joins).map(elem => ({username: elem[0], id: elem[1].metas[0].phx_ref}));
            const peopleThatLeft = Object.entries(payload.leaves).map(elem => ({username: elem[0], id: elem[1].metas[0].phx_ref}));

            updateOnlinePeopleList(currentlyOnlinePeople);
            removePeopleThatLeft(peopleThatLeft);
        }
    });

    channel.on("user_joined", (payload) => {
        // Extract user and room information from the payload
        const user = payload.user;
        const room = payload.room;
    
        // Log the user and room details to the console
        console.log(user);
        console.log(room);
    });
    channel.join()
    .receive("ok", ()=>console.log("Channel joined"))
    .receive("error", ()=>console.log("Failed to join"))
    .receive("timeout", () => console.log("Encountering network connectivity problems. Waiting for the connection to stabilize."))
    var addedIds = new Set();

    function updateOnlinePeopleList(currentlyOnlinePeople) {
        // Set to keep track of added IDs    
        // Add joined people
        for (var i = currentlyOnlinePeople.length - 1; i >= 0; i--) {
            console.log("currentlyOnlinePeople[i]", currentlyOnlinePeople[i]);
            const name = currentlyOnlinePeople[i].username;
            const id = name + "-" + currentlyOnlinePeople[i].id;
    
            // Check if the ID has already been added
            if (!addedIds.has(id)) {
                if (document.getElementById(name) == null) {
                    var liMobile = document.createElement("li"); // create new person list item DOM element for mobile
                    var liDesktop = document.createElement("li"); // create new person list item DOM element for desktop
                    
                    liMobile.id = id + '_mobile';
                    liDesktop.id = id + '_desktop';
                    liMobile.innerHTML = `<caption>${sanitizeString(name)}</caption>`;
                    liDesktop.innerHTML = `<caption>${sanitizeString(name)}</caption>`;
    
                    peopleListMobile.appendChild(liMobile); // append to people list
                    peopleListDesktop.appendChild(liDesktop); // append to people list
    
                    // Add the ID to the set
                    addedIds.add(id);
                }
            }
        }
    }
    

    function removePeopleThatLeft(peopleThatLeft) {
        // Remove people that left
        for (var i = peopleThatLeft.length - 1; i >= 0; i--) {
            const name = peopleThatLeft[i].name;
            const id = name + "-" + peopleThatLeft[i].id;

            const personThatLeftMobile = document.getElementById(id + '_mobile');
            const personThatLeftDesktop = document.getElementById(id +  '_desktop');

            if (personThatLeftMobile != null && personThatLeftDesktop != null) {
                peopleListMobile.removeChild(personThatLeftMobile);         // remove the person from list mobile
                peopleListDesktop.removeChild(personThatLeftDesktop);        // remove the person from list desktop
            }
        }
    }

    /* SENDING MESSAGES FUNCTIONS ------------- */

    // Listening to 'shout' events
    channel.on('new_message', function (payload) {

        console.log("payload", payload);
        render_message(payload);
    });

    // Listening to 'shout' events
    channel.on('archived_message', function (payload) {
        render_message(payload);
    });
    
    // Send the message to the server on "shout" channel
    function sendMessage() {
        channel.push('new_message', {        
            content: msg.value,          // get message text (value) from msg input field.
        });

        msg.value = '';                // reset the message input field for next message.
    }

    // The page does not automatically scroll to show the latest message
    // So invoke this after rendering messages to ensure the last one is in view:
    function scroll_latest_message_into_view() {
        window.scrollTo(0, document.documentElement.scrollHeight) // desktop
        ul.scrollTo(0, ul.scrollHeight)                           // mobile
    }

    // Render the message with Tailwind styles
    function render_message(payload) {
        const li = document.createElement("li"); // create new list item DOM element
        // Message HTML with Tailwind CSS Classes for layout/style:

        let firstCharacter  = payload.created_by_name[0];
        li.innerHTML = `
        <div style="display: flex;justify-content: space-between;" class="flex flex-row w-[95%] mx-2 border-b-[1px] border-slate-300 py-2">
            <div style="height: 30px;
            width: 34px;
            border-radius: 30px;
            background: red;
            margin-right: 5px;" class="thumbnail">${firstCharacter}</div>
            <div class="text-left w-2/5 font-semibold text-slate-800">
            ${payload.created_by_name}
            </div>
            <div class="flex w-3/5 mx-1 grow">
            ${payload.content}
            </div>
        </div>
        `
        // Append to list
        ul.appendChild(li);
        scroll_latest_message_into_view();
    }

    // Listen for the [Enter] keypress event to send a message:
    msg.addEventListener('keypress', function (event) {
        if (event.keyCode == 13 && msg.value.length > 0) { // don't sent empty msg.
            sendMessage()
        }
    });

    // On "Send" button press
    send.addEventListener('click', function (event) {
        if (msg.value.length > 0) { // don't sent empty msg.
            sendMessage()
        }
    });


    /* UTILS ------------ */

    // Date formatting
    function formatDate(datetime) {
        const m = new Date(datetime);
        return m.getUTCFullYear() + "/" 
            + ("0" + (m.getUTCMonth()+1)).slice(-2) + "/" 
            + ("0" + m.getUTCDate()).slice(-2);
    }

    // Time formatting
    function formatTime(datetime) {
        const m = new Date(datetime);
        return ("0" + m.getUTCHours()).slice(-2) + ":"
            + ("0" + m.getUTCMinutes()).slice(-2) + ":"
            + ("0" + m.getUTCSeconds()).slice(-2);
    }

    // Sanitize string input borrowed from:
    // stackoverflow.com/questions/23187013/sanitize-javascript-string
    function sanitizeString(str){
        str = str.replace(/[^a-z0-9áéíóúñü \.,_-]/gim,"");
        return str.trim();
    }
}
