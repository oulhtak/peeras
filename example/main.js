import { createRoom, joinRoom, getRoom } from "./lib/db.js";
import Peeras from "./lib/peeras_bundle.js";

const peer = new Peeras({
  onConnecting: () => {
    console.log("peer connecting");
  },
  onFailed: () => console.log("failed"),
  onConnected: () => {
    $form.remove();
    $content.classList.remove("d-none");
  },
  onClosed: () => console.log("closed"),
  onMessage: (message) => {
    const p = document.createElement("p");
    p.textContent = message;
    $messages.appendChild(p);
  },
  onUploadProgress: (percentage) => {
    $uploadProgress.style.width = percentage.toFixed(2) + "%";
    $uploadProgress.textContent = percentage.toFixed(2) + "%";
    if (percentage == 100) {
      success.style.display = "block";
      $cancelButton.style.display = "none";
      $sendFileBtn.style.display = "block";
      formFile.disabled = false;
    }
  },
  onDownloadProgress: (percentage) => {
    $downloadProgress.style.width = percentage.toFixed(2) + "%";
    $downloadProgress.textContent = percentage.toFixed(2) + "%";
  },
  onInitializingFileTranferFailed: ({ code, message, name }) => {
    $warning.textContent = message;
    $warning.style.display = "block";
    $cancelButton.style.display = "none";
    $sendFileBtn.style.display = "block";
    formFile.disabled = false;
  },
  onFileAbort: () => {
    $warning.innerHTML = "<strong>Warning!</strong> the user canceled the file";
    $warning.style.display = "block";
    $downloadProgress.style.width = "0%";
    $downloadProgress.textContent = "";
  },
});

$form.onsubmit = async function (e) {
  e.preventDefault();
  const id = $roomId.value.trim();
  const options = document.getElementsByName("flexRadioDefault");
  if (options[0].checked) {
    const room = await getRoom(id);
    if (room) {
      alert("the room is already exist, please choose another id");
      return;
    }
    const offer = await peer.initialize();
    await createRoom(id, offer, async (answer) => {
      peer.verify(answer);
    });
    e.target.innerHTML = `
      <div class="alert alert-primary" role="alert">
        waiting for someone to join the room <strong>${id}</strong>
      </div>
    `;
    return;
  }
  joinRoom(id, async (offer) => {
    const answer = await peer.answer({
      offer: offer,
    });
    return answer;
  });
};

$sendFileBtn.onclick = function () {
  const file = formFile.files[0];
  if (!file) {
    $warning.innerHTML = "<strong>Warning!</strong> no file is chosem.";
    $warning.style.display = "block";
    return;
  }

  //resiting
  $uploadProgress.style.width = "0%";
  $uploadProgress.textContent = "";
  $warning.style.display = "none";
  success.style.display = "none";
  $sendFileBtn.style.display = "none";
  $cancelButton.style.display = "block";
  formFile.disabled = true;

  peer.sendFile(file);
};

$cancelButton.onclick = function () {
  $downloadProgress.style.width = "0%";
  $downloadProgress.textContent = "";
  $warning.style.display = "none";
  $warning.style.display = "none";
  $sendFileBtn.style.display = "block";
  $cancelButton.style.display = "none";
  formFile.disabled = false;
  peer.abortFile();
};

$sendMessageBtn.onclick = function () {
  peer.sendMessage($myMessage.value);
  $myMessage.value = "";
};
