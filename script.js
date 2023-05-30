
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

let mousePos = null;
const canvas = document.getElementById('imageCanvas');

let useAngle = false;

canvas.addEventListener("mouseleave", () => { mousePos = null; });
canvas.addEventListener("mousedown", () => { useAngle = !useAngle; console.log("setting angle", useAngle); });

function rescaleCanvas(e) {
  if (e) {
    mousePos = { x: e.clientX, y: e.clientY };
  } else {
    mousePos = null;
  }

  if (img) {
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const quadrantWidth = canvas.width / 2;
    const quadrantHeight = canvas.height / 2;
    const centers = [
      { x: quadrantWidth / 2, y: quadrantHeight / 2 },
      { x: 3 * quadrantWidth / 2, y: quadrantHeight / 2 },
      { x: quadrantWidth / 2, y: 3 * quadrantHeight / 2 },
      { x: 3 * quadrantWidth / 2, y: 3 * quadrantHeight / 2 },
    ];

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const center of centers) {
      let displayWidth, displayHeight, angle;
      if (mousePos) {
        const dx = mousePos.x - center.x;
        const dy = mousePos.y - center.y;
        const diameter = Math.sqrt(dx * dx + dy * dy) * 2;
        const scaleFactor = diameter / Math.sqrt(img.width * img.width + img.height * img.height);
        displayWidth = img.width * scaleFactor;
        displayHeight = img.height * scaleFactor;
        angle = Math.atan2(dy, dx) - Math.atan2(img.height, img.width);
      } else {
        const widthScaleFactor = quadrantWidth / img.width;
        const heightScaleFactor = quadrantHeight / img.height;
        const scaleFactor = Math.min(widthScaleFactor, heightScaleFactor);
        displayWidth = img.width * scaleFactor;
        displayHeight = img.height * scaleFactor;
        angle = 0;
      }

      ctx.save();
      ctx.translate(center.x, center.y);
      if (useAngle) {
        ctx.rotate(angle);
      }
      ctx.drawImage(img, -displayWidth / 2, -displayHeight / 2, displayWidth, displayHeight);
      ctx.restore();
    }
  }
}

window.addEventListener('resize', rescaleCanvas);

window.addEventListener('mousemove', rescaleCanvas);
