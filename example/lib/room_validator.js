$roomId.onkeydown = function (event) {
  var keyCode = event.keyCode;
  const allowed = ![32, 53, 111].includes(keyCode);
  if (allowed) {
    if ($roomId.value.length > 10) {
      $submit.disabled = false;
    } else {
      $submit.disabled = true;
    }
    return true;
  }
  return false;
};

$roomId.onpaste = function () {
  $submit.disabled = false;
};

$generateUniqueId.onclick = function () {
  const timestamp = new Date().getTime().toString(16);
  const random = Math.random().toString(16).substr(2);
  const random2 = Math.random().toString(36).substr(2, 9);
  $roomId.value = timestamp + random + random2;
  $submit.disabled = false;
};
