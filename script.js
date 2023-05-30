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
let auxImageData = null;

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

      // Draw the image onto an auxiliary canvas first
      const auxCanvas = document.createElement('canvas');
      auxCanvas.width = img.width;
      auxCanvas.height = img.height;
      const auxCtx = auxCanvas.getContext('2d');
      auxCtx.drawImage(img, 0, 0, auxCanvas.width, auxCanvas.height);

      // Get the image data from the auxiliary canvas
      auxImageData = auxCtx.getImageData(0, 0, auxCanvas.width, auxCanvas.height);
    }
  };
}

let mousePos = null;
const canvas = document.getElementById('imageCanvas');

let useAngle = false;

canvas.addEventListener("mouseleave", () => { mousePos = null; });
canvas.addEventListener("mousedown", () => { useAngle = !useAngle; });

function rescaleCanvas(e) {
  if (e) {
    mousePos = { x: e.clientX, y: e.clientY };
  } else {
    mousePos = null;
  }

  if (img && auxImageData) {
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const quadrantWidth = Math.floor(canvas.width / 2);
    const quadrantHeight = Math.floor(canvas.height / 2);

    let scaleFactor, displayWidth, displayHeight, angle;

    // Compute scale and rotation based on mouse position in the first quadrant
    if (mousePos) {
      const dx = mousePos.x - quadrantWidth / 2;
      const dy = mousePos.y - quadrantHeight / 2;
      const diameter = Math.sqrt(dx * dx + dy * dy) * 2;
      scaleFactor = diameter / Math.sqrt(img.width * img.width + img.height * img.height);
      angle = Math.atan2(dy, dx) - Math.atan2(img.height, img.width);
    } else {
      const widthScaleFactor = quadrantWidth / img.width;
      const heightScaleFactor = quadrantHeight / img.height;
      scaleFactor = Math.min(widthScaleFactor, heightScaleFactor);
      angle = 0;
    }
    if (!scaleFactor) {
      scaleFactor = 1;
    }
    displayWidth = img.width * scaleFactor;
    displayHeight = img.height * scaleFactor;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw the image in each quadrant with the same scale and rotation
    for (let i = 0; i < 4; ++i) {
      const centerX = ((i % 2 + 0.5) * quadrantWidth);
      const centerY = ((Math.floor(i / 2) + 0.5) * quadrantHeight);

      // Create an empty imageData for the quadrant
      const quadrantImageData = ctx.createImageData(quadrantWidth, quadrantHeight);

      // For every pixel in the quadrant
      for (let y = 0; y < quadrantHeight; ++y) {
        for (let x = 0; x < quadrantWidth; ++x) {
          // Translate and rotate the coordinates
          const dx = x - (quadrantWidth / 2);
          const dy = y - (quadrantHeight / 2);
          const r = Math.sqrt(dx * dx + dy * dy) / scaleFactor;
          const theta = Math.atan2(dy, dx) - (useAngle ? angle : 0);
          const sx = Math.floor(r * Math.cos(theta) + img.width / 2);
          const sy = Math.floor(r * Math.sin(theta) + img.height / 2);

          // Get the pixel from the auxiliary canvas
          if (sx >= 0 && sx < img.width && sy >= 0 && sy < img.height) {
            const srcPixelIndex = (sx + sy * img.width) * 4;
            const dstIndex = (x + y * quadrantWidth) * 4;

            // Copy the pixel data
            for (let i = 0; i < 4; ++i) {
              quadrantImageData.data[dstIndex + i] = auxImageData.data[srcPixelIndex + i];
            }
          }
        }
      }

      // Set the image data onto the actual canvas
      ctx.putImageData(quadrantImageData, centerX - (quadrantWidth / 2), centerY - (quadrantHeight / 2));
    }
  }
}

window.addEventListener('resize', rescaleCanvas);
window.addEventListener('mousemove', rescaleCanvas);
