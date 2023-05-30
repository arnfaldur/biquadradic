
// Create or open IndexedDB database
let db;
const request = indexedDB.open('imageDatabase', 1);
request.onupgradeneeded = function (e) {
  db = e.target.result;
  const objectStore = db.createObjectStore('image', { keyPath: 'id' });
  objectStore.createIndex('id', 'id', { unique: true });
};
request.onsuccess = function (e) {
  db = e.target.result;
  setImage();
};
request.onerror = function (e) {
  console.log('Error', e.target.error);
};

// Function to handle image upload
function handleImageUpload() {
  const file = document.getElementById('imageFile').files[0];
  const reader = new FileReader();

  reader.onloadend = function () {
    const imageData = { id: 'uploadedImage', data: reader.result };
    const transaction = db.transaction(['image'], 'readwrite');
    const objectStore = transaction.objectStore('image');
    objectStore.put(imageData);
    setImage();
  }

  if (file) {
    reader.readAsDataURL(file);
  }
}

// Clear the database when the page is unloaded
window.addEventListener('beforeunload', function () {
  const transaction = db.transaction(['image'], 'readwrite');
  const objectStore = transaction.objectStore('image');
  objectStore.delete('uploadedImage');
});

let img = null;

// Function to display image
function setImage() {
  const transaction = db.transaction(['image'], 'readonly');
  const objectStore = transaction.objectStore('image');
  const request = objectStore.get('uploadedImage');

  request.onsuccess = function () {
    if (request.result) {
      img = new Image();
      img.src = request.result.data;
      img.onload = rescaleCanvas;
    }
  };
}

function rescaleCanvas() {
  if (img) {
    const canvas = document.getElementById('imageCanvas');
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    const widthScaleFactor = canvas.width / img.width;
    const heightScaleFactor = canvas.height / img.height;
    const scaleFactor = Math.min(widthScaleFactor, heightScaleFactor);
    const displayWidth = img.width * scaleFactor;
    const displayHeight = img.height * scaleFactor;
    const displayX = (canvas.width - displayWidth) / 2;
    const displayY = (canvas.height - displayHeight) / 2;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, displayX, displayY, displayWidth, displayHeight);
  }
}

window.addEventListener('resize', rescaleCanvas);
