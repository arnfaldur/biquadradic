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
// window.addEventListener('beforeunload', function () {
//   const transaction = db.transaction(['image'], 'readwrite');
//   const objectStore = transaction.objectStore('image');
//   objectStore.delete('uploadedImage');
// });

let img = new Image();

// Function to set image variable
function setImage() {
  const transaction = db.transaction(['image'], 'readonly');
  const objectStore = transaction.objectStore('image');
  const request = objectStore.get('uploadedImage');

  request.onsuccess = function () {
    if (request.result) {
      img.src = request.result.data;
      img.addEventListener('load', rescaleCanvas);
    }
  };
}

let mousePos = null;
const canvas = document.getElementById('imageCanvas');

let useAngle = false;

canvas.addEventListener("mouseleave", () => { mousePos = null; });
canvas.addEventListener("mousedown", () => { useAngle = !useAngle; });

// WebGL setup
const gl = canvas.getContext('webgl2');
console.log(gl.getParameter(gl.VERSION));
console.log(gl.getParameter(gl.SHADING_LANGUAGE_VERSION));

// WebGL "shader" creation
function createShader(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  const success = gl.getShaderParameter(shader, gl.COMPILE_STATUS);
  if (success) {
    console.log("WebGL shader created", type);
    return shader;
  }
  console.log(gl.getShaderInfoLog(shader));
  gl.deleteShader(shader);
}

// WebGL "program" creation
function createProgram(gl, vertexShader, fragmentShader) {
  const program = gl.createProgram();
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  const success = gl.getProgramParameter(program, gl.LINK_STATUS);
  if (success) {
    console.log("WebGL program created");
    return program;
  }
  console.log(gl.getProgramInfoLog(program));
  gl.deleteProgram(program);
}

// Vertex shader
const vertexShaderSource = `#version 300 es
in vec4 a_position;
in vec2 a_texcoord;

uniform mat4 u_matrix;

out vec2 v_texcoord;

void main() {
    vec4 pos = u_matrix * a_position;
    gl_Position = pos;
    v_texcoord = a_texcoord;
}
`;

// Fragment shader
const fragmentShaderSource = `#version 300 es
precision mediump float;

in vec2 v_texcoord;
out vec4 fragColor;
uniform sampler2D u_texture;

void main() {
    vec2 coord = v_texcoord;
    fragColor = texture(u_texture, coord);
    //fragColor = texelFetch(u_texture, ivec2(coord), 0);
}
`;

const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);
const program = createProgram(gl, vertexShader, fragmentShader);

// get vertex data
let positionLocation = gl.getAttribLocation(program, "a_position");
let texcoordLocation = gl.getAttribLocation(program, "a_texcoord");

// get uniforms
let matrixLocation = gl.getUniformLocation(program, "u_matrix");
let textureLocation = gl.getUniformLocation(program, "u_texture");

// Create a buffer.
let positionBuffer = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);

// Put a unit quad in the buffer
let positions = [
  0, 0,
  0, 1,
  1, 0,
  1, 0,
  0, 1,
  1, 1,
];
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);

// Create a buffer for texture coords
let texcoordBuffer = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, texcoordBuffer);

// Put texcoords in the buffer
let texcoords = [
  0, 0,
  0, 1,
  1, 0,
  1, 0,
  0, 1,
  1, 1,
];
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(texcoords), gl.STATIC_DRAW);

// creates a texture info { width: w, height: h, texture: tex }
// The texture will start with 1x1 pixels and be updated
// when the image has loaded
function createTextureInfo(img) {
  var tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);

  // let's assume all images are not a power of 2
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);

  var textureInfo = {
    width: 1,   // we don't know the size until it loads
    height: 1,
    texture: tex,
  };
  img.addEventListener('load', () => {
    textureInfo.width = img.width;
    textureInfo.height = img.height;

    gl.bindTexture(gl.TEXTURE_2D, textureInfo.texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
  });
  return textureInfo;
}

const tex = createTextureInfo(img);


console.log(tex);

window.addEventListener('resize', rescaleCanvas);
window.addEventListener('mousemove', (e) => {
  mousePos = e ? { x: e.clientX, y: e.clientY } : null;
  drawCanvas();
});

function rescaleCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  drawCanvas();
}

function drawCanvas() {
  if (!img) {
    return;
  }
  const quadrantWidth = Math.floor(canvas.width / 2);
  const quadrantHeight = Math.floor(canvas.height / 2);

  let scaleFactor = 1, displayWidth, displayHeight, angle;

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
  displayWidth = img.width * scaleFactor;
  displayHeight = img.height * scaleFactor;

  // // Set WebGL specific settings
  gl.viewport(0, 0, canvas.width, canvas.height);
  // gl.clearColor(0, 0, 0, 0);
  gl.clear(gl.COLOR_BUFFER_BIT);

  gl.useProgram(program);


  // Draw the image in each quadrant with the same scale and rotation
  for (let i = 0; i < 4; ++i) {
    const centerX = ((i % 2 + 0.5) * quadrantWidth);
    const centerY = ((Math.floor(i / 2) + 0.5) * quadrantHeight);

    drawImage(tex.texture,
      displayWidth,
      displayHeight,
      centerX,
      centerY,
      angle,
    );
  }
}


// Unlike images, textures do not have a width and height associated
// with them so we'll pass in the width and height of the texture
function drawImage(tex, texWidth, texHeight, dstX, dstY, angle) {
  gl.bindTexture(gl.TEXTURE_2D, tex);

  // Tell WebGL to use our shader program pair
  gl.useProgram(program);

  // Setup the attributes to pull data from our buffers
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
  gl.enableVertexAttribArray(positionLocation);
  gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);
  gl.bindBuffer(gl.ARRAY_BUFFER, texcoordBuffer);
  gl.enableVertexAttribArray(texcoordLocation);
  gl.vertexAttribPointer(texcoordLocation, 2, gl.FLOAT, false, 0, 0);

  const sw = texWidth / gl.canvas.width;
  const sh = texHeight / gl.canvas.height;

  matrix = new Float32Array([
    2 * sw, 0.0, 0.0, 0.0,
    0.0, -2 * sh, 0.0, 0.0,
    0.0, 0.0, 0.0, 0.0,
    (dstX / gl.canvas.width * 2) - 1 - sw, (dstY / gl.canvas.height * 2) - 1 + sh, 0.0, 1.0,
  ]);
  // rotm = [
  //   Math.cos(angle), -Math.sin(angle),
  //   Math.sin(angle), Math.cos(angle),
  // ]
  // let dst = new Float32Array(16);
  // dst[0] = matrix[0] * Math.cos(angle);
  // dst[4] = matrix[4] * Math.cos(angle);
  // dst[8] = matrix[8] * Math.cos(angle);
  // dst[12] = matrix[12] * Math.cos(angle) + matrix[13] * Math.sin(angle);
  // //dst[1] = matrix[1] * -Math.sin(angle);
  // dst[5] = matrix[5] * -Math.sin(angle);
  // //dst[9] = matrix[9] * -Math.sin(angle);
  // dst[13] = matrix[12] * -Math.sin(angle) + matrix[13] * Math.cos(angle);
  // //dst[0] = matrix[0] * -Math.sin(angle);
  // dst[15] = 1.0;

  // matrix = dst;

  // console.log("matrix changed");
  // console.log(matrix.slice(0, 4));
  // console.log(matrix.slice(4, 8));
  // console.log(matrix.slice(8, 12));
  // console.log(matrix.slice(12, 16));

  // Set the matrix.
  gl.uniformMatrix4fv(matrixLocation, false, matrix);

  // Tell the shader to get the texture from texture unit 0
  gl.uniform1i(textureLocation, 0);

  // draw the quad (2 triangles, 6 vertices)
  gl.drawArrays(gl.TRIANGLES, 0, 6);
}


  // * // Set uniforms for resolution
  // const resolutionLocation = gl.getUniformLocation(program, "u_resolution");
  // gl.uniform2f(resolutionLocation, canvas.width, canvas.height);

  // // Create and bind a buffer for position
  // const positionBuffer = gl.createBuffer();
  // gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
  // const positionLocation = gl.getAttribLocation(program, "a_position");
  // gl.enableVertexAttribArray(positionLocation);
  // gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

  // // Draw the image in each quadrant with the same scale and rotation
  // for (let i = 0; i < 4; ++i) {
  //   const centerX = ((i % 2 + 0.5) * quadrantWidth);
  //   const centerY = ((Math.floor(i / 2) + 0.5) * quadrantHeight);

  //   const rectangle = [
  //     centerX - displayWidth / 2, centerY - displayHeight / 2,
  //     centerX + displayWidth / 2, centerY - displayHeight / 2,
  //     centerX - displayWidth / 2, centerY + displayHeight / 2,
  //     centerX + displayWidth / 2, centerY + displayHeight / 2
  //   ];
  //   gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(rectangle), gl.STATIC_DRAW);

  //   const colorLocation = gl.getUniformLocation(program, "u_color");
  //   gl.uniform4f(colorLocation, i / 4, 0, 0, 1);  // change the color for each quadrant

  //   // Draw the rectangle
  //   gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  // }
