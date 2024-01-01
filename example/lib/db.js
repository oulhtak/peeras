import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  getDatabase,
  ref,
  get,
  child,
  set,
  onValue,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

// These constiables are supposed to be public
// If these are no longer wirking, use yours and secure them with firebase rules
const firebaseConfig = {
  apiKey: "AIzaSyAy661ggwubkUm5xGudoGlbAcodInUZ4SM",
  authDomain: "peeras-72984.firebaseapp.com",
  databaseURL:
    "https://peeras-72984-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "peeras-72984",
  storageBucket: "peeras-72984.appspot.com",
  messagingSenderId: "72144857563",
  appId: "1:72144857563:web:12c6520b8361ce6a329ffe",
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

async function getRoom(roomId) {
  const dbRef = ref(db);
  const snapshot = await get(child(dbRef, roomId));
  return snapshot.val();
}

async function createRoom(roomId, offer, onAnswer) {
  const roomRef = ref(db, roomId);
  await set(roomRef, { offer });

  onValue(roomRef, (snapshot) => {
    console.log("snapshot for answer", snapshot.val());
    if (snapshot.val() && snapshot.val().answer) {
      onAnswer(snapshot.val().answer);
    }
  });
}

async function joinRoom(roomId, onOffer) {
  const room = await getRoom(roomId);
  if (!room) {
    throw new Error("Room does not exist");
  }
  const answer = await onOffer(room.offer);
  room.answer = answer;
  const roomRef = ref(db, roomId);
  await set(roomRef, room);
}

export { createRoom, joinRoom, getRoom };
