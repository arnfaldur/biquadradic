function uploadImage() {
  var file = document.getElementById('imageFile').files[0];
  var reader = new FileReader();

  reader.onloadend = function () {
    localStorage.setItem('image', reader.result);
    displayImage();
  }

  if (file) {
    reader.readAsDataURL(file);
  }
}

function displayImage() {
  var storedImage = localStorage.getItem('image');
  if (storedImage) {
    document.getElementById('displayImage').src = storedImage;
  }
}

window.onload = function () {
  displayImage();
}
