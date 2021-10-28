

//touch 14.26

var DAT = DAT || {};

DAT.Globe = function(container, opts) {
  opts = opts || {};
  //_________________________________________________ COLORE BARRE_________________________________________________
  var colorFn = opts.colorFn || function(x) {
    var c = new THREE.Color();
    //    c.setRGB(0.69 , ( 0.1 + ( x/15 ) ), 0.64);
    c.setRGB(1 - x / 200, 1 - x / 10, 0.4);
    return c;
  };

  var Shaders = {
    'earth': {
      uniforms: {
        'texture': {
          type: 't',
          value: null
        }
      },
      vertexShader: [
        'varying vec3 vNormal;',
        'varying vec2 vUv;',
        'void main() {',
        'gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );',
        'vNormal = normalize( normalMatrix * normal );',
        'vUv = uv;',
        '}'
      ].join('\n'),
      fragmentShader: [
        'uniform sampler2D texture;',
        'varying vec3 vNormal;',
        'varying vec2 vUv;',
        'void main() {',
        'vec3 diffuse = texture2D( texture, vUv ).xyz;',
        'float intensity = 1.05 - dot( vNormal, vec3( 0.0, 0.0, 1.0 ) );',
        'vec3 atmosphere = vec3( 0.68, 1, 0.64 ) * pow( intensity, 3.0 );', //__________________________________________ Alone interno
        'gl_FragColor = vec4( diffuse + atmosphere, 1.0 );',
        '}'
      ].join('\n')
    },
    'atmosphere': {
      uniforms: {},
      vertexShader: [
        'varying vec3 vNormal;',
        'void main() {',
        'vNormal = normalize( normalMatrix * normal );',
        'gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );',
        '}'
      ].join('\n'),
      fragmentShader: [
        'varying vec3 vNormal;',
        'void main() {',
        'float intensity = pow( 0.8 - dot( vNormal, vec3( 0, 0, 1.0 ) ), 12.0 );',
        'gl_FragColor = vec4( 0.68, 1, 0.64, 1.0 ) * intensity;', //__________________________________________ bordino
        '}'
      ].join('\n')
    }
  };

  var camera, scene, renderer, w, h;
  var mesh, atmosphere, point;

  var overRenderer;

  var curZoomSpeed = 0; //_________________________________________________ZOOM AUTOMATICO
  var zoomSpeed = 150;

  var mouse = {
      x: 0,
      y: 0
    },
    mouseOnDown = {
      x: 0,
      y: 0
    };
  var rotation = {
      x: 0,
      y: 0
    },
    target = {
      x: Math.PI * 3 / 2,
      y: Math.PI / 6.0
    },
    targetOnDown = {
      x: 0,
      y: 0
    };

  var distance = 100000,
      distanceTarget = 100000;
  var padding = 40;
  var PI_HALF = Math.PI / 2;

  //__________________________________________ TOUCH START __________________________________________
  var touchHandled;
     var isPinchScaling;
     var pinchStartX;
     var clickTimer;

     //disabled pinch zooming by default due to as weird bugs in Safari but leaving in, in case someone else can fix it
     var pinchZoomEnabled = opts.pinchZoomEnabled || true;

     /**
      * (Modified from `jquery-ui-touchpunch`)
      * Simulate a mouse event based on a corresponding touch event
      * @param {Object} event A touch event
      * @param {String} simulatedType The corresponding mouse event
      */
     function simulateMouseEvent(event, simulatedType) {

       var touch;

       // Ignore multi-touch events
       if(event.originalEvent){
         touch = event.originalEvent.changedTouches[0];

         if (event.originalEvent.touches.length == 2) {
           //handle pinching
           isPinchScaling = true;
           pinchStartX = event.originalEvent.touches[0].clientX;
           onPinch(event);

           return;
         }
         else if (event.originalEvent.touches.length > 2 && event.originalEvent.touches.length < 10){
           return;
         }
         else if (event.originalEvent.touches.length == 10){
           location.reload();
         }
       }
       else if(event.touches){
         touch = event.changedTouches[0];

         if(event.touches.length == 2){
           //handle pinching
           isPinchScaling = true;
           pinchStartX = event.touches[0].clientX;
           onPinch(event);

           return;
         }
         else if(event.touches.length > 2 && event.touches.length < 10){
           return;
         }
         else if (event.touches.length == 10){
           location.reload();
         }

       }

       event.preventDefault();

       var simulatedEvent = document.createEvent('MouseEvents');

       // Initialize the simulated mouse event using the touch event's coordinates
       simulatedEvent.initMouseEvent(
         simulatedType,    // type
         true,             // bubbles
         true,             // cancelable
         window,           // view
         1,                // detail
         touch.screenX,    // screenX
         touch.screenY,    // screenY
         touch.clientX,    // clientX
         touch.clientY,    // clientY
         false,            // ctrlKey
         false,            // altKey
         false,            // shiftKey
         false,            // metaKey
         0,                // button
         null              // relatedTarget
       );

       // Dispatch the simulated event to the target element
       event.target.dispatchEvent(simulatedEvent);
     }
                                                        //doppio click disattivato
     function resetZoomOnDoubleTap(event){
       // check for double tap
       if(pinchZoomEnabled) {
         if ((event.originalEvent && event.originalEvent.touches.length == 1) ||
           (event.touches && event.touches.length == 1)) {

           if (clickTimer == null) {
             clickTimer = setTimeout(function () {
               clickTimer = null;
             }, 300)
           } else {
             clearTimeout(clickTimer);
             clickTimer = null;

             //reset zoom
             zoom(-5000);
           }
         }
       }
     }

     function _onTouchStart (event) {
       var self = this;
       if (touchHandled){
         return;
       }
       touchHandled = true;
       self._touchMoved = false;
       simulateMouseEvent(event, 'mouseover');
       simulateMouseEvent(event, 'mousemove');
       simulateMouseEvent(event, 'mousedown');
     }


     function _onTouchMove(event) {
       if(isPinchScaling){
         onPinch(event);
         return;
       }
       if (!touchHandled) {
         return;
       }
       this._touchMoved = true;
       simulateMouseEvent(event, 'mousemove');
     }

     function _onTouchEnd(event) {
       if(isPinchScaling){
         onPinch(event);
         isPinchScaling = false
         return;
       }
       if (!touchHandled) {
         return;
       }
       simulateMouseEvent(event, 'mouseup');
       simulateMouseEvent(event, 'mouseout');
       if (!this._touchMoved) {
         simulateMouseEvent(event, 'click');
       }
       touchHandled = false;
     }

     function getPinchDistance(event){
       var dist;

       try{
         dist = Math.sqrt(
           (event.touches[0].clientX-event.touches[1].clientX) * (event.touches[0].clientX-event.touches[1].clientX) +
           (event.touches[0].clientY-event.touches[1].clientY) * (event.touches[0].clientY-event.touches[1].clientY)
         );

         dist = dist * 0.1;
         dist = Math.min(dist, 25);

         var dir = (pinchStartX > event.touches[0].clientX) ? 1 : -1;

         dist = dist * dir;
       }
       catch(e){
         dist = null;
       }

       return dist;
     }

     function onPinch(event){
       if(pinchZoomEnabled){
         var dist = getPinchDistance(event)
         if(dist != null){
           zoom(dist);
         }
       }
     }


     function addTouchHandlers(container){

       var touchSupport = 'ontouchend' in document;

       //ignore browsers without touch
       if(!touchSupport){
         return;
       }

       container.addEventListener('touchstart', _onTouchStart, false);
     }
  //__________________________________________ TOUCH END __________________________________________

  var raycaster  = new THREE.Raycaster();
  var mouse = new THREE.Vector3();
  var mapCanvas, mapContext, lookupCanvas, lookupContext, lookupTexture, composer;

  var countryColorMap = {
    'PE':1, 'BF':2,'FR':3,'LY':4,'BY':5,'PK':6,'ID':7,'YE':8,'MG':9,'BO':10,'CI':11,'DZ':12,'CH':13,'CM':14,'MK':15,'BW':16,'UA':17,
    'KE':18,'TW':19,'JO':20,'MX':21,'AE':22,'BZ':23,'BR':24,'SL':25,'ML':26,'CD':27,'IT':28,'SO':29,'AF':30,'BD':31,'DO':32,'GW':33,
    'GH':34,'AT':35,'SE':36,'TR':37,'UG':38,'MZ':39,'JP':40,'NZ':41,'CU':42,'VE':43,'PT':44,'CO':45,'MR':46,'AO':47,'DE':48,'SD':49,
    'TH':50,'AU':51,'PG':52,'IQ':53,'HR':54,'GL':55,'NE':56,'DK':57,'LV':58,'RO':59,'ZM':60,'IR':61,'MM':62,'ET':63,'GT':64,'SR':65,
    'EH':66,'CZ':67,'TD':68,'AL':69,'FI':70,'SY':71,'KG':72,'SB':73,'OM':74,'PA':75,'AR':76,'GB':77,'CR':78,'PY':79,'GN':80,'IE':81,
    'NG':82,'TN':83,'PL':84,'NA':85,'ZA':86,'EG':87,'TZ':88,'GE':89,'SA':90,'VN':91,'RU':92,'HT':93,'BA':94,'IN':95,'CN':96,'CA':97,
    'SV':98,'GY':99,'BE':100,'GQ':101,'LS':102,'BG':103,'BI':104,'DJ':105,'AZ':106,'MY':107,'PH':108,'UY':109,'CG':110,'RS':111,'ME':112,'EE':113,
    'RW':114,'AM':115,'SN':116,'TG':117,'ES':118,'GA':119,'HU':120,'MW':121,'TJ':122,'KH':123,'KR':124,'HN':125,'IS':126,'NI':127,'CL':128,'MA':129,
    'LR':130,'NL':131,'CF':132,'SK':133,'LT':134,'ZW':135,'LK':136,'IL':137,'LA':138,'KP':139,'GR':140,'TM':141,'EC':142,'BJ':143,'SI':144,'NO':145,
    'MD':146,'LB':147,'NP':148,'ER':149,'US':150,'KZ':151,'AQ':152,'SZ':153,'UZ':154,'MN':155,'BT':156,'NC':157,'FJ':158,'KW':159,'TL':160,'BS':161,
    'VU':162,'FK':163,'GM':164,'QA':165,'JM':166,'CY':167,'PR':168,'PS':169,'BN':170,'TT':171,'CV':172,'PF':173,'WS':174,'LU':175,'KM':176,'MU':177,
    'FO':178,'ST':179,'AN':180,'DM':181,'TO':182,'KI':183,'FM':184,'BH':185,'AD':186,'MP':187,'PW':188,'SC':189,'AG':190,'BB':191,'TC':192,'VC':193,
    'LC':194,'YT':195,'VI':196,'GD':197,'MT':198,'MV':199,'KY':200,'KN':201,'MS':202,'BL':203,'NU':204,'PM':205,'CK':206,'WF':207,'AS':208,'MH':209,
    'AW':210,'LI':211,'VG':212,'SH':213,'JE':214,'AI':215,'MF_1_':216,'GG':217,'SM':218,'BM':219,'TV':220,'NR':221,'GI':222,'PN':223,'MC':224,'VA':225,
    'IM':226,'GU':227,'SG':228,'SSD':229};

var renderer, canvas, canvasPosition, camera, scene, rayCaster,  mousePosition;

  function init() {
    container.style.color = '#fff';
    container.style.background = "#04160b"
    container.style.font = '13px/20px Arial, sans-serif';

    var shader, uniforms, material;
    w = container.offsetWidth || window.innerWidth;
    h = container.offsetHeight || window.innerHeight;

    camera = new THREE.PerspectiveCamera(30, w / h, 1, 10000);
    camera.position.z = distance;

    scene = new THREE.Scene();

    var geometry = new THREE.SphereGeometry(200, 64, 32);

    geometry.rotateY(Math.PI)

    shader = Shaders['earth'];
    uniforms = THREE.UniformsUtils.clone(shader.uniforms);

    var mapTexture = new THREE.TextureLoader().load("images/textureGray.png");
      mapTexture.magFilter = THREE.NearestFilter;
      mapTexture.minFilter = THREE.NearestFilter;
      mapTexture.needsUpdate = true;

    var outlineTexture = new THREE.TextureLoader().load("images/outline.png");
      outlineTexture.magFilter = THREE.LinearFilter;
      outlineTexture.minFilter = THREE.LinearFilter;
      outlineTexture.needsUpdate = true;

    var blendImage = new THREE.TextureLoader().load('world.jpg');
      blendImage.magFilter = THREE.LinearFilter;
      blendImage.minFilter = THREE.LinearFilter;
      blendImage.needsUpdate = true;

    lookupCanvas = document.createElement('canvas');
  	lookupCanvas.width = 256;
  	lookupCanvas.height = 1;
  	lookupContext = lookupCanvas.getContext('2d');
  	lookupTexture = new THREE.Texture( lookupCanvas );
  	lookupTexture.magFilter = THREE.NearestFilter;
  	lookupTexture.minFilter = THREE.NearestFilter;
  	lookupTexture.needsUpdate = true;

    var material = new THREE.ShaderMaterial(
  	{
  		uniforms:
  		{
  			width:      { type: "f", value: window.innerWidth },
  			height:     { type: "f", value: window.innerHeight },
  			mapIndex:   { type: "t", value: mapTexture },
  			outline:    { type: "t", value: outlineTexture },
  			lookup:     { type: "t", value: lookupTexture },
  			blendImage: { type: "t", value: blendImage }
  		},
  		vertexShader: document.getElementById( 'globeVertexShader' ).textContent,
  		fragmentShader: document.getElementById( 'globeFragmentShader' ).textContent
  	});

    material.needsUpdate = true

    mesh = new THREE.Mesh(geometry, material);
    mesh.rotation.y = Math.PI;
    scene.add(mesh);

    mapCanvas = document.createElement('canvas');
    mapCanvas.width = 4096;
    mapCanvas.height = 2048;
      mapContext = mapCanvas.getContext('2d');
      var imageObj = new Image();
      imageObj.onload = function()
    {
          mapContext.drawImage(imageObj, 0, 0);
      };
      imageObj.src = 'images/textureGray.png';

    	composer = new THREE.EffectComposer( renderer );

    	var renderModel = new THREE.RenderPass( scene, camera );

    	var effectFXAA = new THREE.ShaderPass( THREE.FXAAShader );
    	var width = window.innerWidth || 2;
    	var height = window.innerHeight || 2;
    	effectFXAA.uniforms[ 'resolution' ].value.set( 1 / width, 1 / height );

    	var effectCopy = new THREE.ShaderPass( THREE.CopyShader );
    	effectCopy.renderToScreen = true;

    	composer.addPass( renderModel );
    	composer.addPass( effectFXAA );
    	composer.addPass( effectCopy );

    shader = Shaders['atmosphere'];
    uniforms = THREE.UniformsUtils.clone(shader.uniforms);

    material = new THREE.ShaderMaterial({

      uniforms: uniforms,
      vertexShader: shader.vertexShader,
      fragmentShader: shader.fragmentShader,
      side: THREE.BackSide,
      blending: THREE.AdditiveBlending,
      transparent: true
    });


    mesh = new THREE.Mesh(geometry, material); //_________________________________________________ GLOW
    mesh.scale.set(1.05, 1.05, 1.05);
    scene.add(mesh);

    geometry = new THREE.BoxGeometry(2, 2, 1); //_________________________________________________ DIAMETRO
    geometry.applyMatrix(new THREE.Matrix4().makeTranslation(0, 0, -0.5));

    point = new THREE.Mesh(geometry);

    renderer = new THREE.WebGLRenderer({
      antialias: true
    });
    renderer.setSize(w, h);

    renderer.domElement.style.position = 'absolute';

    container.appendChild(renderer.domElement);

    container.addEventListener('mousedown', onMouseDown, false);

    container.addEventListener('mousewheel', onMouseWheel, false);

    container.addEventListener('click', _onClick, false);

    addTouchHandlers(container);

    document.addEventListener('keydown', onDocumentKeyDown, false);

    window.addEventListener('resize', onWindowResize, false);

    container.addEventListener('mouseover', function() {
      overRenderer = true;
    }, false);

    container.addEventListener('mouseout', function() {
      overRenderer = false;
    }, false);

  }

  function addData(data, opts) {
    var lat, lng, size, color, i, step, colorFnWrapper;

    opts.animated = opts.animated || false;
    this.is_animated = opts.animated;
    opts.format = opts.format || 'magnitude'; // other option is 'legend'
    if (opts.format === 'magnitude') {
      step = 3;
      colorFnWrapper = function(data, i) {
        return colorFn(data[i + 2]);
      }
    } else if (opts.format === 'legend') {
      step = 4;
      colorFnWrapper = function(data, i) {
        return colorFn(data[i + 3]);
      }
    } else {
      throw ('error: format not supported: ' + opts.format);
    }

    if (opts.animated) {
      if (this._baseGeometry === undefined) {
        this._baseGeometry = new THREE.Geometry();
        for (i = 0; i < data.length; i += step) {
          lat = data[i];
          lng = data[i + 1];
          //        size = data[i + 2];
          color = colorFnWrapper(data, i);
          size = 0;
          addPoint(lat, lng, size, color, this._baseGeometry);
        }
      }
      if (this._morphTargetId === undefined) {
        this._morphTargetId = 0;
      } else {
        this._morphTargetId += 1;
      }
      opts.name = opts.name || 'morphTarget' + this._morphTargetId;
    }
    var subgeo = new THREE.Geometry();
    for (i = 0; i < data.length; i += step) {
      lat = data[i];
      lng = data[i + 1];
      color = colorFnWrapper(data, i);
      size = data[i + 2];
      size = size * 3.5; //_________________________________________________ALTEZZA
      addPoint(lat, lng, size, color, subgeo);
    }
    if (opts.animated) {
      this._baseGeometry.morphTargets.push({
        'name': opts.name,
        vertices: subgeo.vertices
      });
    } else {
      this._baseGeometry = subgeo;
    }

  };

  function createPoints() {
    if (this._baseGeometry !== undefined) {
      if (this.is_animated === false) {
        this.points = new THREE.Mesh(this._baseGeometry, new THREE.MeshBasicMaterial({
          color: 0xffffff,
          opacity: 0.5,
          transparent: false,
          vertexColors: THREE.FaceColors,
          morphTargets: false
        }));
      } else {
        if (this._baseGeometry.morphTargets.length < 8) {
          // console.log('t l', this._baseGeometry.morphTargets.length);
          var padding = 8 - this._baseGeometry.morphTargets.length;
          // console.log('padding', padding);
          for (var i = 0; i <= padding; i++) {
            // console.log('padding', i);
            this._baseGeometry.morphTargets.push({
              'name': 'morphPadding' + i,
              vertices: this._baseGeometry.vertices
            });
          }
        }
        this.points = new THREE.Mesh(this._baseGeometry, new THREE.MeshBasicMaterial({
          color: 0xffffff,
          opacity: 0.85,
          transparent: false,
          depthWrite: false,
          vertexColors: THREE.FaceColors,
          morphTargets: true
        }));
      }
      scene.add(this.points);
    }
    this.points.rotateY(-Math.PI);
  }

  function addPoint(lat, lng, size, color, subgeo) {

    var phi = (90 - lat) * Math.PI / 180;
    var theta = (180 - lng) * Math.PI / 180;

    point.position.x = 200 * Math.sin(phi) * Math.cos(theta);
    point.position.y = 200 * Math.cos(phi);
    point.position.z = 200 * Math.sin(phi) * Math.sin(theta);

    point.lookAt(mesh.position);

    point.scale.z = Math.max(size, 0.1); // avoid non-invertible matrix
    point.updateMatrix();

    for (var i = 0; i < point.geometry.faces.length; i++) {

      point.geometry.faces[i].color = color;

    }
    if (point.matrixAutoUpdate) {
      point.updateMatrix();
    }
    subgeo.merge(point.geometry, point.matrix);
  }

  function _onClick(event) {
    event.preventDefault();

    // start Raycaster code
    mouse.x = ( event.clientX / window.innerWidth ) * 2 - 1;
    mouse.y = - ( event.clientY / window.innerHeight ) * 2 + 1;

    raycaster.setFromCamera( mouse, camera );

  // calculate objects intersecting the picking ray
   var intersects = raycaster.intersectObjects( scene.children );

   if ( intersects.length > 0 ) {
    data = intersects[0];
    var d = data.point.clone().normalize();
    var u = Math.round(mapCanvas.width * (1 - (0.5 + Math.atan2(d.z, d.x) / (2 * Math.PI))));
    var v = Math.round(mapCanvas.height * (0.5 - Math.asin(d.y) / (Math.PI)));
    var p = mapContext.getImageData(u,v,1,1).data;
    countryCode = p[0];

    for( var prop in countryColorMap ) {
        if( countryColorMap.hasOwnProperty( prop ) ) {
             if( countryColorMap[ prop ] === countryCode ) {
                // console.log(prop, countryCode);

                if ( prop == "AF") {
                  paginaPopup(33.93911, 67.709953, 'Afghanistan',
                  [0.54, 0.08, 0.16, 0.16, 0.18, 0.20, 0.21, 0.27, 0.30, 0.37, 0.45, 0.49, 0.52, 0.50, 0.43, 0.35, 0.32, 0.69, 0.35],
                  [26364, 26782, 23589, 26867, 25438, 27381, 30212, 32115, 23830, 30147, 31447, 32062, 34518, 35570, 42352, 48126, 52810, 26380, 51624],
                  [0.54, 0.08, 0.16, 0.16, 0.18, 0.20, 0.21, 0.27, 0.30, 0.37, 0.45, 0.49, 0.52, 0.50, 0.43, 0.35, 0.32, 0.69, 0.36],
                  [26364, 26782, 23589, 26867, 25438, 27381, 30212, 32115, 23830, 30147, 31447, 32062, 34518, 35570, 42352, 48126, 52810, 26380, 49435],
                  30)
                }

                else if ( prop == "AL") {
                  paginaPopup(41.153323, 21.168331, 'Albania',
                  [2.39, 2.90, 3.39, 4.72, 5.68, 8.18, 9.56, 11.40, 13.16, 13.54, 12.75, 14.11, 13.27, 14.12, 14.65, 12.80, 13.46, 14.86, 6.80],
                  [1397, 1300, 1219, 1136, 1201, 929, 873, 866, 897, 810, 848, 826, 839, 820, 822, 814, 811, 809, 2008],
                  [2.39, 2.90, 3.39, 4.72, 5.68, 8.18, 9.56, 11.40, 13.16, 13.54, 12.75, 14.11, 13.27, 14.12, 14.65, 12.80, 13.46, 14.86, 16.38],
                  [1397, 1300, 1219, 1136, 1201, 929, 873, 866, 897, 810, 848, 826, 839, 820, 822, 814, 811, 809, 834],
                  69)
                }

                else if ( prop == "DZ") {
                  paginaPopup(28.033886,1.659626,'Algeria',
                  [2.57, 2.63, 2.83, 3.19, 4.71, 5.89, 6.72, 7.65, 9.91, 7.98, 15.89, 12.06, 12.74, 12.80, 12.98, 10.14, 9.93, 10.81, 6.16],
                  [19394, 18967, 18261, 19378, 16464, 15926, 15828, 16035, 15681, 15627, 15067,  15048, 14883, 14851, 14923, 14816, 14494, 14258, 21449],
                  [2.57, 2.63, 2.83, 3.19, 4.71, 5.89, 6.72, 7.65, 9.91, 7.98, 15.89, 12.06, 12.74, 12.80, 12.98, 10.14, 9.93, 10.81, 7.06],
                  [19394, 18967, 18261, 19378, 16464, 15926, 15828, 16035, 15681, 15627, 15067,  15048, 14883, 14851, 14923, 14816, 14494, 14258, 18698],
                  12)
                }
                else if ( prop == "AD") {
                  paginaPopup(42.546245, 1.601554, 'Andorra',
                  [59.42, 62.18, 70.00, 85.94, 97.92, 106.01, 109.02, 122.13, 133.08, 122.54, 113.20, 126.90, 123.85, 131.37, 131.57, 102.34, 116.09, 105.45, 22.72],
                  [23, 22, 22, 24, 25, 25, 26, 26, 27, 27, 27, 25, 24, 24, 25, 25, 25, 25, 125],
                  [59.42, 62.18, 70.00, 85.94, 97.92, 106.01, 109.02, 122.13, 133.08, 122.54, 113.20, 126.90, 123.85, 131.37, 131.57, 102.34, 116.09, 105.45, 69.23],
                  [23, 22, 22, 24, 25, 25, 26, 26, 27, 27, 27, 25, 24, 24, 25, 25, 25, 25, 41],
                  186)
                }
                else if ( prop == "AO") {
                  paginaPopup(-11.202692,17.873667, 'Angola',
                  [0.36, 0.36, 0.57, 0.67, 0.87, 1.27, 1.88, 2.72, 3.85, 3.54, 3.92, 5.00, 5.56, 6.19, 6.47, 5.23, 4.95, 6.48, 3.24],
                  [20988, 20797, 18232, 17794, 18892, 18571, 18531, 18495, 18163, 17663, 17415, 17176, 16846, 16552, 16036, 16033, 15722, 15619, 17513],
                  [0.36, 0.36, 0.57, 0.67, 0.87, 1.27, 1.88, 2.72, 3.85, 3.54, 3.92, 5.00, 5.56, 6.19, 6.47, 5.23, 4.95, 6.48, 3.31],
                  [20988, 20797, 18232, 17794, 18892, 18571, 18531, 18495, 18163, 17663, 17415, 17176, 16846, 16552, 16036, 16033, 15722, 15619, 17114],
                  47)
                }
                else if ( prop == "AG") {
                  paginaPopup(17.060816, -61.796428, 'Antigua & Barbuda',
                  [23.15, 22.55, 22.18, 23.28, 24.21, 26.89, 29.49, 33.40, 36.63, 33.76, 28.43, 28.15, 30.74, 30.26, 32.45, 34.58, 36.98, 37.66, 32.73],
                  [30, 30, 31, 31, 32, 32, 33, 33, 34, 33, 34, 34, 33, 33, 33, 33, 33, 34, 39],
                  [23.15, 22.55, 22.18, 23.28, 24.21, 26.89, 29.49, 33.40, 36.63, 33.76, 28.43, 28.15, 30.74, 30.26, 32.45, 34.58, 36.98, 37.66, 37.49],
                  [30, 30, 31, 31, 32, 32, 33, 33, 34, 33, 34, 34, 33, 33, 33, 33, 33, 34, 34],
                  190)
                }
                else if ( prop == "SA") {
                  paginaPopup(23.885942,45.079162, 'Saudi Arabia',
                  [14.50, 13.91, 13.71, 15.09, 18.07, 22.54, 24.49, 26.82, 32.86, 25.97, 27.22, 33.06, 34.54, 33.30, 32.26, 23.93, 26.75, 23.68, 15.66],
                  [12611, 12867,  13509, 14014, 14467, 14657, 15393, 15428, 15618,  16177, 16570, 17099, 17691, 18359, 18955, 22204, 21861,  22798, 40696],
                  [14.50, 13.91, 13.71, 15.09, 18.07, 22.54, 24.49, 26.82, 32.86, 25.97, 27.22, 33.06, 34.54, 33.30, 32.26, 23.93, 26.75, 23.68, 18.48],
                  [12611, 12867,  13509, 14014, 14467, 14657, 15393, 15428, 15618,  16177, 16570, 17099, 17691, 18359, 18955, 22204, 21861,  22798, 34482],
                  90)
                }
                else if ( prop == "AR") {
                  paginaPopup(-38.416097, -63.616672, 'Argentina',
                  [12.10, 11.29, 3.99, 5.40, 7.29, 8.78, 10.13, 12.00, 15.06, 13.78, 17.63, 21.62, 21.82, 21.67, 21.09, 24.12, 35.62, 25.61, 5.29],
                  [21372, 21657, 21911, 21508, 20561, 20592, 20900, 21813, 21847, 21987, 21868, 22318, 22769, 23175, 22704, 22440, 22625, 22656, 65664],
                  [12.10, 11.29, 3.99, 5.40, 7.29, 8.78, 10.13, 12.00, 15.06, 13.78, 17.63, 21.62, 21.82, 21.67, 21.09, 24.12, 35.62, 25.61, 15.33],
                  [21372, 21657, 21911, 21508, 20561, 20592, 20900, 21813, 21847, 21987, 21868, 22318, 22769, 23175, 22704, 22440, 22625, 22656, 22646],
                  76 )
                }
                else if ( prop == "AM") {
                  paginaPopup(40.069099,45.038189, 'Armenia',
                  [1.25, 1.42, 1.66, 2.00, 2.60, 3.55, 4.58, 6.83, 8.47, 6.30, 1.03, 7.52, 8.17, 8.99, 9.46, 8.36, 8.01, 9.79, 2.92],
                  [1395, 1362, 1311, 1283, 1263, 1272, 1288, 1249, 1281, 1283, 8429, 1266, 1223, 1164, 1155, 1189, 1240, 1109, 3935],
                  [1.25, 1.42, 1.66, 2.00, 2.60, 3.55, 4.58, 6.83, 8.47, 6.30, 1.03, 7.52, 8.17, 8.99, 9.46, 8.36, 8.01, 9.79, 10.15],
                  [1395, 1362, 1311, 1283, 1263, 1272, 1288, 1249, 1281, 1283, 8429, 1266, 1223, 1164, 1155, 1189, 1240, 1109, 1133],
                  115)
                }
                else if ( prop == "AU") {
                  paginaPopup(-25.274398, 133.775136, 'Australia',
                  [46.10, 46.15, 47.08, 56.58, 74.12, 83.42, 88.74, 98.50, 118.07, 99.44, 124.27, 148.46, 164.87, 162.80, 145.98, 129.04, 114.77, 123.05, 112.14],
                  [8173, 7417, 7571, 7439, 7460, 7511, 7611, 7927, 8159, 8509, 8429, 8624, 8582, 8727, 9178, 9561, 9617, 9804, 10721],
                  [46.10, 46.15, 47.08, 56.58, 74.12, 83.42, 88.74, 98.50, 118.07, 99.44, 124.27, 148.46, 164.87, 162.80, 145.98, 129.04, 114.77, 123.05, 122.53],
                  [8173, 7417, 7571, 7439, 7460, 7511, 7611, 7927, 8159, 8509, 8429, 8624, 8582, 8727, 9178, 9561, 9617, 9804, 9812],
                  51)
                }
                else if ( prop == "AT") {
                  paginaPopup(47.516231, 14.550072, 'Austria',
                  [40.91, 42.68, 45.16, 56.12, 64.14, 66.37, 72.81, 83.94, 92.97, 85.01, 82.99, 93.48, 87.83, 92.62, 93.98, 82.21, 83.29, 88.87, 36.93],
                  [4399, 4227, 4317, 4261, 4282, 4336, 4200, 4217, 4217, 4293, 4312, 4213, 4255, 4229, 4264, 4181, 4188, 4161, 10675],
                  [40.91, 42.68, 45.16, 56.12, 64.14, 66.37, 72.81, 83.94, 92.97, 85.01, 82.99, 93.48, 87.83, 92.62, 93.98, 82.21, 83.29, 88.87, 91.31],
                  [4399, 4227, 4317, 4261, 4282, 4336, 4200, 4217, 4217, 4293, 4312, 4213, 4255, 4229, 4264, 4181, 4188, 4161, 4318],
                  35)
                }
                else if ( prop == "AZ") {
                  paginaPopup(40.143105, 47.576927, 'Azerbaijan',
                  [1.60, 1.84, 1.82, 2.35, 2.77, 4.05, 6.57, 13.56, 14.81, 13.36, 15.64, 19.28, 20.34, 21.67, 21.80, 15.24, 10.83, 12.10, 6.83],
                  [3022, 2848, 3168, 2861, 2911, 3040, 2969, 2265, 3038, 3028, 3093, 3131, 3139, 3141, 3172, 3204, 3218, 3098, 5697],
                  [1.60, 1.84, 1.82, 2.35, 2.77, 4.05, 6.57, 13.56, 14.81, 13.36, 15.64, 19.28, 20.34, 21.67, 21.80, 15.24, 10.83, 12.10, 12.46],
                  [3022, 2848, 3168, 2861, 2911, 3040, 2969, 2265, 3038, 3028, 3093, 3131, 3139, 3141, 3172, 3204, 3218, 3098, 3122],
                  106)
                }
                else if ( prop == "BS") {
                  paginaPopup(25.03428,-77.39628, 'Bahamas',
                  [37.66, 37.66, 38.67, 41.61, 39.43, 43.24, 43.03, 43.13, 41.10, 37.38, 39.43, 35.40, 36.30, 35.10, 36.61, 35.29, 39.76, 40.87, 19.84],
                  [217, 201, 209, 194, 209, 207, 215, 224, 233, 243, 233, 259, 269, 276, 273, 305, 272, 272, 516],
                  [37.66, 37.66, 38.67, 41.61, 39.43, 43.24, 43.03, 43.13, 41.10, 37.38, 39.43, 35.40, 36.30, 35.10, 36.61, 35.29, 39.76, 40.87, 29.58],
                  [217, 201, 209, 194, 209, 207, 215, 224, 233, 243, 233, 259, 269, 276, 273, 305, 272, 272, 346],
                  161)
                }
                else if ( prop == "BRN") {
                  paginaPopup(25.930414, 50.637772, 'Bahrain',
                  [21.11, 32.68, 35.01, 38.81, 42.22, 48.69, 45.54, 87.09, 77.30, 69.34, 78.76, 83.09, 92.58, 97.36, 101.85, 93.54, 95.27, 96.05, 51.04],
                  [392, 249, 247, 254, 276, 291, 363, 225, 303, 304, 302, 322, 310, 312, 304, 304, 301, 318, 737],
                  [21.11, 32.68, 35.01, 38.81, 42.22, 48.69, 45.54, 87.09, 77.30, 69.34, 78.76, 83.09, 92.58, 97.36, 101.85, 93.54, 95.27, 96.05, 97.70],
                  [392, 249, 247, 254, 276, 291, 363, 225, 303, 304, 302, 322, 310, 312, 304, 304, 301, 318, 385],
                  1)
                }
                else if ( prop == "BD") {
                  paginaPopup(23.684994, 90.356331, 'Bangladesh',
                  [0.62, 0.63, 0.65, 0.71, 0.77, 0.83, 0.88, 0.90, 1.12, 1.30, 1.49, 1.74, 1.88, 2.17, 2.57, 2.96, 3.45, 3.93, 5.82],
                  [78418, 77507, 76647, 76856, 76481, 76151, 73945, 80287, 74038, 71697, 70043, 67004, 64261, 62714, 61127, 59990, 58308, 57812, 50656],
                  [0.62, 0.63, 0.65, 0.71, 0.77, 0.83, 0.88, 0.90, 1.12, 1.30, 1.49, 1.74, 1.88, 2.17, 2.57, 2.96, 3.45, 3.93, 6.85],
                  [78418, 77507, 76647, 76856, 76481, 76151, 73945, 80287, 74038, 71697, 70043, 67004, 64261, 62714, 61127, 59990, 58308, 57812, 43097],
                  31)
                }
                else if ( prop == "BB") {
                  paginaPopup(13.193887, -59.543198, 'Barbados',
                  [23.39, 23.83, 23.64, 23.84, 25.18, 27.71, 30.19, 32.41, 33.01, 32.02, 32.22, 33.40, 33.90, 33.05, 32.76, 32.34, 31.46, 33.07, 27.87],
                  [121, 119, 122, 125, 127, 128, 128, 127, 127, 126, 126, 127, 125, 127, 128, 129, 131, 132, 143],
                  [23.39, 23.83, 23.64, 23.84, 25.18, 27.71, 30.19, 32.41, 33.01, 32.02, 32.22, 33.40, 33.90, 33.05, 32.76, 32.34, 31.46, 33.07, 29.31],
                  [121, 119, 122, 125, 127, 128, 128, 127, 127, 126, 126, 127, 125, 127, 128, 129, 131, 132, 136],
                  191)
                }
                else if ( prop == "BY") {
                  paginaPopup(53.709807, 27.953389, 'Belarus',
                  [0.84, 0.79, 0.91, 1.17, 1.57, 1.98, 2.62, 3.31, 4.41, 3.64, 4.28, 4.62, 5.99, 7.37, 8.06, 6.19, 5.46, 6.20, 5.75],
                  [14329, 14881, 15332, 14640, 14258, 14780, 13733, 12656, 12739, 12488, 12310, 12310, 10176, 9481, 8902, 8299, 8015, 8037, 9590],
                  [0.84, 0.79, 0.91, 1.17, 1.57, 1.98, 2.62, 3.31, 4.41, 3.64, 4.28, 4.62, 5.99, 7.37, 8.06, 6.19, 5.46, 6.20, 6.74],
                  [14329, 14881, 15332, 14640, 14258, 14780, 13733, 12656, 12739, 12488, 12310, 12310, 10176, 9481, 8902, 8299, 8015, 8037, 8176],
                  5)
                }
                else if ( prop == "BE") {
                  paginaPopup(50.503887, 4.469936, 'Belgium',
                  [30.39, 30.25, 33.28, 41.43, 49.89, 55.00, 55.33, 62.49, 67.19, 62.42, 62.15, 65.89, 61.41, 64.72, 68.02, 57.23, 58.89, 63.89, 17.25],
                  [7135, 7138, 7100, 7040, 6811, 6460, 6794, 6922, 7070, 7102, 7102, 7250, 7346, 7305, 7112, 7251, 7134, 7062, 27267],
                  [30.39, 30.25, 33.28, 41.43, 49.89, 55.00, 55.33, 62.49, 67.19, 62.42, 62.15, 65.89, 61.41, 64.72, 68.02, 57.23, 58.89, 63.89, 61.61],
                  [7135, 7138, 7100, 7040, 6811, 6460, 6794, 6922, 7070, 7102, 7102, 7250, 7346, 7305, 7112, 7251, 7134, 7062, 7634],
                  100)
                }
                else if ( prop == "BZ") {
                  paginaPopup(17.189877, -88.49765, 'Belize',
                  [3.40, 3.43, 4.14, 4.33, 4.54, 4.51, 4.99, 5.17, 5.17, 5.03, 4.95, 5.16, 5.36, 5.38, 5.62, 5.64, 5.77, 5.47, 2.87],
                  [223, 231, 205, 208, 212, 225, 222, 227, 241, 242, 257, 262, 267, 273, 276, 287, 299, 306, 562],
                  [3.40, 3.43, 4.14, 4.33, 4.54, 4.51, 4.99, 5.17, 5.17, 5.03, 4.95, 5.16, 5.36, 5.38, 5.62, 5.64, 5.77, 5.47, 5.00],
                  [223, 231, 205, 208, 212, 225, 222, 227, 241, 242, 257, 262, 267, 273, 276, 287, 299, 306, 321],
                  23)
                }
                else if ( prop == "BJ") {
                  paginaPopup(9.30769, 2.315834, 'Benin',
                  [0.41, 0.43, 0.48, 0.60, 0.71, 0.76, 0.81, 0.94, 1.11, 1.07, 1.03, 1.11, 1.10, 1.21, 1.28, 1.07, 1.12, 1.21, 2.24],
                  [5722, 5773, 5931, 6068, 5941, 5872, 5946, 5938, 6045, 6215, 6365, 6632, 6971, 7123, 7134, 7240, 7165, 7139, 6371],
                  [0.41, 0.43, 0.48, 0.60, 0.71, 0.76, 0.81, 0.94, 1.11, 1.07, 1.03, 1.11, 1.10, 1.21, 1.28, 1.07, 1.12, 1.21, 2.25],
                  [5722, 5773, 5931, 6068, 5941, 5872, 5946, 5938, 6045, 6215, 6365, 6632, 6971, 7123, 7134, 7240, 7165, 7139, 6327],
                  143);
                }
                else if ( prop == "BT") {
                  paginaPopup(27.514162, 90.433601, 'Bhutan',
                  [0.73, 1.27, 1.45, 1.69, 1.93, 2.25, 2.47, 3.26, 3.38, 3.14, 4.15, 4.67, 4.64, 4.52, 4.83, 5.15, 5.42, 6.11, 6.44],
                  [539, 336, 333, 331, 328, 328, 331, 331, 339, 363, 344, 351, 353, 357, 361, 364, 365, 367, 341],
                  [0.73, 1.27, 1.45, 1.69, 1.93, 2.25, 2.47, 3.26, 3.38, 3.14, 4.15, 4.67, 4.64, 4.52, 4.83, 5.15, 5.42, 6.11, 6.44],
                  [539, 336, 333, 331, 328, 328, 331, 331, 339, 363, 344, 351, 353, 357, 361, 364, 365, 367, 341],
                  156)
                }
                else if ( prop == "MM") {
                  paginaPopup(21.913965, 95.956223, 'Myanmar',
                  [0.21, 0.16, 0.17, 0.26, 0.26, 0.27, 0.37, 0.53, 0.17, 1.01, 1.39, 1.67, 1.68, 1.73, 1.93, 1.72, 1.88, 1.72, 2.43],
                  [39780, 38993, 38413, 37355, 37819, 41326, 36533, 35971, 173199, 34372, 33533, 33776, 33389, 32579, 31787, 32509, 31492, 37700, 28525],
                  [0.21, 0.16, 0.17, 0.26, 0.26, 0.27, 0.37, 0.53, 0.17, 1.01, 1.39, 1.67, 1.68, 1.73, 1.93, 1.72, 1.88, 1.72, 2.68],
                  [39780, 38993, 38413, 37355, 37819, 41326, 36533, 35971, 173199, 34372, 33533, 33776, 33389, 32579, 31787, 32509, 31492, 37700, 25843],
                  62)
                }
                else if ( prop == "BO") {
                  paginaPopup(-16.290154, -63.588653, 'Bolivia',
                  [1.10, 1.10, 1.07, 1.11, 1.23, 1.39, 1.65, 1.90, 2.41, 2.55, 2.85, 3.47, 3.97, 4.44, 4.74, 4.85, 5.00, 5.52, 2.12],
                  [6934, 6724, 6754, 6641, 6469, 6271, 6330, 6299, 6309, 6196, 6266, 6289, 6208, 6285, 6328, 6187, 6175, 6187, 15766],
                  [1.10, 1.10, 1.07, 1.11, 1.23, 1.39, 1.65, 1.90, 2.41, 2.55, 2.85, 3.47, 3.97, 4.44, 4.74, 4.85, 5.00, 5.52, 5.03],
                  [6934, 6724, 6754, 6641, 6469, 6271, 6330, 6299, 6309, 6196, 6266, 6289, 6208, 6285, 6328, 6187, 6175, 6187, 6631],
                  10)
                }
                else if ( prop == "BA") {
                  paginaPopup(43.915886, 17.679076, 'Bosnia and Herzegovina',
                  [3.54, 3.92, 4.58, 5.89, 7.19, 7.88, 9.25, 10.92, 12.77, 13.28, 13.37, 14.99, 14.13, 14.93, 14.97, 9.14, 14.31, 15.63, 3.43],
                  [1425, 1343, 1332, 1307, 1283, 1314, 1285, 1338, 1286, 1236, 1205, 1176, 1164, 1175, 1208, 1183, 1163, 1144, 5254],
                  [3.54, 3.92, 4.58, 5.89, 7.19, 7.88, 9.25, 10.92, 12.77, 13.28, 13.37, 14.99, 14.13, 14.93, 14.97, 9.14, 14.31, 15.63, 14.96],
                  [1425, 1343, 1332, 1307, 1283, 1314, 1285, 1338, 1286, 1236, 1205, 1176, 1164, 1175, 1208, 1183, 1163, 1144, 1204],
                  94)
                }
                else if ( prop == "BW") {
                  paginaPopup(-22.328474, 24.684866, 'Botswana',
                  [6.10, 5.55, 5.28, 7.13, 8.39, 9.36, 9.65, 10.91, 10.80, 10.07, 13.51, 15.11, 14.14, 14.08, 15.32, 13.49, 14.68, 16.20, 6.91],
                  [867, 903, 941, 962, 975, 970, 961, 920, 932, 941, 945, 962, 965, 986, 988, 996, 993, 1000, 2079],
                  [6.10, 5.55, 5.28, 7.13, 8.39, 9.36, 9.65, 10.91, 10.80, 10.07, 13.51, 15.11, 14.14, 14.08, 15.32, 13.49, 14.68, 16.20, 7.04],
                  [867, 903, 941, 962, 975, 970, 961, 920, 932, 941, 945, 962, 965, 986, 988, 996, 993, 1000, 2039],
                  16)
                }
                else if ( prop == "BR") {
                  paginaPopup(-14.235004, -51.92528, 'Brazil',
                  [4.13, 3.50, 3.13, 3.41, 4.10, 5.52, 6.82, 8.53, 10.21, 9.86, 12.82, 14.69, 13.91, 13.66, 13.46, 9.92, 9.88, 11.34, 3.64],
                  [144779, 146147, 148563, 149748, 149803, 148154, 149152, 150336, 152530, 155315, 158277, 163578, 162712, 166269, 167505, 166806, 170001, 166429, 360965],
                  [4.13, 3.50, 3.13, 3.41, 4.10, 5.52, 6.82, 8.53, 10.21, 9.86, 12.82, 14.69, 13.91, 13.66, 13.46, 9.92, 9.88, 11.34, 7.81],
                  [144779, 146147, 148563, 149748, 149803, 148154, 149152, 150336, 152530, 155315, 158277, 163578, 162712, 166269, 167505, 166806, 170001, 166429, 168284],
                  24)
                }
                else if ( prop == "BN") {
                  paginaPopup(4.535277, 114.727669, 'Brunei',
                  [41.27, 38.31, 39.88, 44.72, 53.46, 63.21, 75.10, 78.96, 91.96, 66.44, 83.16, 111.70, 112.00, 103.73, 96.78, 70.99, 62.58, 64.28, 68.85],
                  [131, 132, 132, 132, 134, 136, 139, 141, 143, 147, 150, 153, 157, 161, 163, 168, 168, 174, 159],
                  [41.27, 38.31, 39.88, 44.72, 53.46, 63.21, 75.10, 78.96, 91.96, 66.44, 83.16, 111.70, 112.00, 103.73, 96.78, 70.99, 62.58, 64.28, 70.18],
                  [131, 132, 132, 132, 134, 136, 139, 141, 143, 147, 150, 153, 157, 161, 163, 168, 168, 174, 156],
                  170)
                }
                else if ( prop == "BG") {
                  paginaPopup(42.733883, 25.48583, 'Bulgaria',
                  [2.25, 2.57, 3.14, 4.20, 5.30, 6.10, 7.13, 9.58, 12.07, 12.08, 12.35, 14.58, 13.76, 14.98, 17.48, 13.55, 14.41, 15.42, 5.73],
                  [5199, 4947, 4730, 4567, 4468, 4437, 4371, 4231, 4112, 3918, 3735, 3588, 3563, 3381, 2945, 3358, 3349, 3340, 11012],
                  [2.25, 2.57, 3.14, 4.20, 5.30, 6.10, 7.13, 9.58, 12.07, 12.08, 12.35, 14.58, 13.76, 14.98, 17.48, 13.55, 14.41, 15.42, 18.04],
                  [5199, 4947, 4730, 4567, 4468, 4437, 4371, 4231, 4112, 3918, 3735, 3588, 3563, 3381, 2945, 3358, 3349, 3340, 3497],
                  103)
                }
                else if ( prop == "BF") {
                  paginaPopup(12.238333,-1.561593, 'Burkina Faso',
                  [0.27, 0.29, 0.32, 0.42, 0.48, 0.54, 0.56, 0.64, 0.77, 0.76, 0.79, 0.91, 0.89, 0.92, 0.91, 0.74, 0.78, 0.87, 0.97],
                  [8865, 8912, 9125, 9106, 9214, 9173, 9492, 9567, 9853, 10015, 10419, 10741, 11438, 11847, 12322, 12766, 13316, 13376, 16329],
                  [0.27, 0.29, 0.32, 0.42, 0.48, 0.54, 0.56, 0.64, 0.77, 0.76, 0.79, 0.91, 0.89, 0.92, 0.91, 0.74, 0.78, 0.87, 0.97],
                  [8865, 8912, 9125, 9106, 9214, 9173, 9492, 9567, 9853, 10015, 10419, 10741, 11438, 11847, 12322, 12766, 13316, 13376, 16247],
                  2)
                }
                else if ( prop == "BI") {
                  paginaPopup(-3.373056, 29.918886, 'Burundi',
                  [0.05, 0.05, 0.05, 0.04, 0.05, 0.06, 0.26, 0.28, 0.32, 0.36, 0.40, 0.45, 0.49, 0.52, 0.58, 0.51, 0.53, 0.62, 0.54],
                  [18524, 17970, 17516, 17725, 17170, 17415, 4760, 4655, 4866, 4783, 4991, 5107, 5031, 5154, 5343, 6037, 5685, 5603, 5519],
                  [0.05, 0.05, 0.05, 0.04, 0.05, 0.06, 0.26, 0.28, 0.32, 0.36, 0.40, 0.45, 0.49, 0.52, 0.58, 0.51, 0.53, 0.62, 0.54],
                  [18524, 17970, 17516, 17725, 17170, 17415, 4760, 4655, 4866, 4783, 4991, 5107, 5031, 5154, 5343, 6037, 5685, 5603, 5517],
                  104)
                }
                else if ( prop == "KH") {
                  paginaPopup(12.565679, 104.990963, 'Cambodia',
                  [0.25, 0.28, 0.31, 0.34, 0.39, 0.47, 0.54, 0.65, 0.78, 0.77, 0.81, 0.93, 1.03, 1.09, 1.20, 1.30, 1.43, 1.59, 2.64],
                  [13347, 12883, 12786, 12585, 12422, 12227, 12208, 12231, 12197, 12304, 12694, 12658, 12518, 12736, 12689, 12720, 12761, 12772, 8717],
                  [0.25, 0.28, 0.31, 0.34, 0.39, 0.47, 0.54, 0.65, 0.78, 0.77, 0.81, 0.93, 1.03, 1.09, 1.20, 1.30, 1.43, 1.59, 2.64],
                  [13347, 12883, 12786, 12585, 12422, 12227, 12208, 12231, 12197, 12304, 12694, 12658, 12518, 12736, 12689, 12720, 12761, 12772, 8717],
                  123)
                }
                else if ( prop == "CM") {
                  paginaPopup(7.369722, 12.354722, 'Cameroon',
                  [0.97, 0.99, 1.07, 1.31, 1.57, 1.56, 1.61, 1.81, 2.06, 1.98, 1.92, 2.12, 2.10, 2.34, 2.32, 1.97, 2.16, 2.37, 2.24],
                  [9879, 9956, 10265, 10538, 10551, 10867, 11371, 11644, 12091, 12366, 12778, 12946, 12942, 12906, 14018, 14601, 13851, 13617, 16174],
                  [0.97, 0.99, 1.07, 1.31, 1.57, 1.56, 1.61, 1.81, 2.06, 1.98, 1.92, 2.12, 2.10, 2.34, 2.32, 1.97, 2.16, 2.37, 2.30],
                  [9879, 9956, 10265, 10538, 10551, 10867, 11371, 11644, 12091, 12366, 12778, 12946, 12942, 12906, 14018, 14601, 13851, 13617, 15726],
                   14) // da qui in poi tutti gli array hanno il penultimo dato come [0], quel sotto-array va sostituito con quello del file che ti ho mandato, ti basta copiare il contenuto delle quadre e incollarlo al posto dello 0
                }
                else if ( prop == "CA") {
                  paginaPopup(56.130366, -106.346771, 'Canada',
                  [50.87, 49.08, 49.74, 57.44, 65.81, 72.07, 82.53, 89.43, 91.58, 80.07, 95.89, 103.48, 105.39, 105.89, 100.41, 85.07, 83.64, 89.24, 45.76],
                  [13249, 13614, 13835, 14101, 14115, 14739, 14523, 14949, 15447, 15637, 15367, 15802, 15806, 15870, 16331, 16734, 16719, 16818, 32458],
                  [50.87, 49.08, 49.74, 57.44, 65.81, 72.07, 82.53, 89.43, 91.58, 80.07, 95.89, 103.48, 105.39, 105.89, 100.41, 85.07, 83.64, 89.24, 86.95],
                  [13249, 13614, 13835, 14101, 14115, 14739, 14523, 14949, 15447, 15637, 15367, 15802, 15806, 15870, 16331, 16734, 16719, 16818, 17080],
                  97)
                }
                else if ( prop == "CV") {
                  paginaPopup(16.002082, -24.013197, 'Cabo Verde',
                  [2.66, 1.81, 2.23, 2.85, 3.21, 3.35, 3.73, 4.30, 6.13, 5.52, 5.93, 6.22, 6.56, 6.94, 5.56, 7.53, 10.68, 11.10, 3.38],
                  [254, 257, 260, 261, 262, 263, 268, 325, 272, 280, 285, 289, 291, 292, 296, 321, 300, 301, 458],
                  [2.66, 1.81, 2.23, 2.85, 3.21, 3.35, 3.73, 4.30, 6.13, 5.52, 5.93, 6.22, 6.56, 6.94, 5.56, 7.53, 10.68, 11.10, 4.48],
                  [254, 257, 260, 261, 262, 263, 268, 325, 272, 280, 285, 289, 291, 292, 296, 321, 300, 301, 346],
                  172)
                }
                else if ( prop == "TD") {
                  paginaPopup(15.454166, 18.732207, 'Chad',
                  [0.18, 0.23, 0.04, 0.37, 0.56, 0.81, 0.67, 0.90, 1.08, 1.06, 1.19, 1.35, 1.35, 1.38, 1.47, 1.06, 0.95, 0.96, 0.97],
                  [7135, 6666, 6785, 6789, 7107, 7463, 10055, 8720, 8735, 7958, 8127, 8206, 8341, 8519, 8632, 9465, 9063, 9447, 9512],
                  [0.18, 0.23, 0.04, 0.37, 0.56, 0.81, 0.67, 0.90, 1.08, 1.06, 1.19, 1.35, 1.35, 1.38, 1.47, 1.06, 0.95, 0.96, 0.98],
                  [7135, 6666, 6785, 6789, 7107, 7463, 10055, 8720, 8735, 7958, 8127, 8206, 8341, 8519, 8632, 9465, 9063, 9447, 9408],
                  68)
                }
                else if ( prop == "CL") {
                  paginaPopup(-35.675147,	-71.542969, 'Chile',
                  [17.93, 18.24, 19.27, 19.08, 20.58, 23.12, 23.91, 28.23, 28.27, 27.55, 28.36, 33.84, 39.03, 40.00, 46.41, 48.44, 48.13, 49.09, 9.29],
                  [7754, 7623, 7319, 7407, 7508, 7518, 7847, 7567, 7961, 8151, 8386, 8027, 7561, 7616, 7746, 7868, 8206, 8328, 24774],
                  [17.93, 18.24, 19.27, 19.08, 20.58, 23.12, 23.91, 28.23, 28.27, 27.55, 28.36, 33.84, 39.03, 40.00, 46.41, 48.44, 48.13, 49.09, 27.82],
                  [7754, 7623, 7319, 7407, 7508, 7518, 7847, 7567, 7961, 8151, 8386, 8027, 7561, 7616, 7746, 7868, 8206, 8328, 8275],
                  128)
                }
                else if ( prop == "CN") {
                  paginaPopup(35.8616,104.195397,'China',
                  [1.27, 1.49, 1.70, 1.95, 2.24, 2.62, 3.25, 4.25, 4.91, 6.03, 7.16, 9.13, 10.44, 11.81, 12.74, 13.38, 13.59, 15.16, 19.34],
                  [871052, 818589, 786931, 773767, 795094, 793373, 769310, 760310, 852011, 771016, 775531, 755364, 746424, 740827, 749564, 753034, 749434, 733517, 711213],
                  [1.27, 1.49, 1.70, 1.95, 2.24, 2.62, 3.25, 4.25, 4.91, 6.03, 7.16, 9.13, 10.44, 11.81, 12.74, 13.38, 13.59, 15.16, 19.47],
                  [871052, 818589, 786931, 773767, 795094, 793373, 769310, 760310, 852011, 771016, 775531, 755364, 746424, 740827, 749564, 753034, 749434, 733517, 706425],
                  96)
                }
                else if ( prop == "CY") {
                  paginaPopup(35.126413,33.429859, 'Cyprus',
                  [24.68, 26.23, 29.24, 36.99, 44.21, 45.81, 54.76, 65.26, 77.73, 72.38, 72.29, 76.14, 110.02, 69.93, 68.30, 57.62, 58.36, 61.39, 44.22],
                  [509, 501, 498, 497, 499, 518, 472, 464, 445, 439, 427, 429, 270, 414, 420, 426, 433, 443, 662],
                  [24.68, 26.23, 29.24, 36.99, 44.21, 45.81, 54.76, 65.26, 77.73, 72.38, 72.29, 76.14, 110.02, 69.93, 68.30, 57.62, 58.36, 61.39, 53.92],
                  [509, 501, 498, 497, 499, 518, 472, 464, 445, 439, 427, 429, 270, 414, 420, 426, 433, 443, 543],
                  167)
                }
                else if ( prop == "CO") {
                  paginaPopup(4.570868, -74.297333, 'Colombia',
                  [4.95, 4.89, 5.08, 6.12, 6.66, 8.99, 9.97, 9.18, 10.83, 10.84, 12.16, 13.99, 15.22, 16.16, 18.86, 21.13, 20.07, 20.44, 3.27],
                  [45945, 47109, 48320, 39366, 38438, 34518, 34321, 32469, 33117, 35361, 33597, 31308, 30746, 29512, 28060, 28166, 31018, 31595, 75473],
                  [4.95, 4.89, 5.08, 6.12, 6.66, 8.99, 9.97, 9.18, 10.83, 10.84, 12.16, 13.99, 15.22, 16.16, 18.86, 21.13, 20.07, 20.44, 7.52],
                  [45945, 47109, 48320, 39366, 38438, 34518, 34321, 32469, 33117, 35361, 33597, 31308, 30746, 29512, 28060, 28166, 31018, 31595, 32853],
                  45)
                }
                else if ( prop == "KM") {
                  paginaPopup(-11.875001, 43.872219, 'Comoros',
                  [0.59, 0.65, 0.70, 0.96, 1.08, 1.03, 1.03, 1.06, 1.46, 0.93, 1.46, 1.17, 1.38, 1.52, 1.74, 1.51, 1.64, 1.73, 2.63],
                  [314, 309, 324, 305, 314, 340, 362, 399, 330, 517, 335, 459, 381, 374, 343, 345, 347, 351, 423],
                  [0.59, 0.65, 0.70, 0.96, 1.08, 1.03, 1.03, 1.06, 1.46, 0.93, 1.46, 1.17, 1.38, 1.52, 1.74, 1.51, 1.64, 1.73, 2.68],
                  [314, 309, 324, 305, 314, 340, 362, 399, 330, 517, 335, 459, 381, 374, 343, 345, 347, 351, 414],
                  176)
                }
                else if ( prop == "KP") {
                  paginaPopup(40.339852, 127.510093, 'Korea, North',
                  [0.75, 0.64, 0.66, 0.66, 0.65, 0.74, 0.77, 0.78, 0.75, 0.67, 0.78, 0.87, 0.87, 0.92, 0.97, 0.91, 0.90, 0.96, 0.79],
                  [14164, 14672, 14927, 15275, 15714, 15924, 16144, 16765, 16198, 16290, 16369, 16432, 16554, 16440, 16321, 16351, 16886, 16541, 19048],
                  [0.75, 0.64, 0.66, 0.66, 0.65, 0.74, 0.77, 0.78, 0.75, 0.67, 0.78, 0.87, 0.87, 0.92, 0.97, 0.91, 0.90, 0.96, 0.79],
                  [14164, 14672, 14927, 15275, 15714, 15924, 16144, 16765, 16198, 16290, 16369, 16432, 16554, 16440, 16321, 16351, 16886, 16541, 19048],
                  139)
                }
                else if ( prop == "KR") {
                  paginaPopup(35.907757, 127.766922, 'Korea, South',
                  [27.84, 17.08, 18.86, 19.29, 22.42, 26.09, 30.78, 33.48, 29.51, 24.81, 30.14, 33.24, 35.20, 37.76, 43.06, 42.98, 41.52, 44.18, 44.85],
                  [17999, 28632, 28762, 31456, 30476, 30864, 29504, 30137, 30475, 32661, 32644, 32445, 31153, 31015, 29349, 28784, 30477, 30978, 32759],
                  [27.84, 17.08, 18.86, 19.29, 22.42, 26.09, 30.78, 33.48, 29.51, 24.81, 30.14, 33.24, 35.20, 37.76, 43.06, 42.98, 41.52, 44.18, 46.11],
                  [17999, 28632, 28762, 31456, 30476, 30864, 29504, 30137, 30475, 32661, 32644, 32445, 31153, 31015, 29349, 28784, 30477, 30978, 31859],
                  124)
                }
                else if ( prop == "CI") {
                  paginaPopup(7.539989, -5.54708, "Ivory Coast",
                  [0.79, 0.84, 0.84, 1.04, 1.15, 1.20, 1.23, 1.40, 1.69, 1.70, 1.71, 1.59, 1.76, 1.97, 2.17, 2.01, 2.21, 2.49, 4.43],
                  [12262, 11848, 13189, 13197, 12971, 12799, 12964, 13007, 12842, 12812, 13006, 14290, 13767, 14201, 14543, 14722, 14630, 14428, 12626],
                  [0.79, 0.84, 0.84, 1.04, 1.15, 1.20, 1.23, 1.40, 1.69, 1.70, 1.71, 1.59, 1.76, 1.97, 2.17, 2.01, 2.21, 2.49, 4.47],
                  [12262, 11848, 13189, 13197, 12971, 12799, 12964, 13007, 12842, 12812, 13006, 14290, 13767, 14201, 14543, 14722, 14630, 14428, 12489],
                  11)
                }
                else if ( prop == "CR") {
                  paginaPopup(9.748917, -83.753428, 'Costa Rica',
                  [13.14, 10.86, 16.93, 17.61, 18.40, 23.24, 22.77, 22.84, 22.30, 22.64, 20.63, 20.54, 25.51, 27.37, 27.76, 28.28, 28.38, 30.18, 11.70],
                  [1817, 2680, 1851, 1935, 1983, 1891, 2147, 1927, 2073, 1979, 2259, 2460, 2119, 2013, 2193, 2361, 2501, 2537, 4785],
                  [13.14, 10.86, 16.93, 17.61, 18.40, 23.24, 22.77, 22.84, 22.30, 22.64, 20.63, 20.54, 25.51, 27.37, 27.76, 28.28, 28.38, 30.18, 21.30],
                  [1817, 2680, 1851, 1935, 1983, 1891, 2147, 1927, 2073, 1979, 2259, 2460, 2119, 2013, 2193, 2361, 2501, 2537, 2629],
                  78)
                }
                else if ( prop == "HR") {
                  paginaPopup(45.1,15.2, 'Croatia',
                  [8.02, 10.47, 12.97, 14.77, 15.53, 17.12, 19.30, 20.76, 23.77, 23.02, 22.97, 25.96, 23.86, 25.02, 27.39, 27.32, 30.52, 34.09, 7.74],
                  [2905, 2742, 2707, 2859, 2870, 2878, 2753, 2953, 3035, 2987, 2968, 2767, 2951, 2758, 2750, 2888, 2834, 2701, 6674],
                  [8.02, 10.47, 12.97, 14.77, 15.53, 17.12, 19.30, 20.76, 23.77, 23.02, 22.97, 25.96, 23.86, 25.02, 27.39, 27.32, 30.52, 34.09, 18.76],
                  [2905, 2742, 2707, 2859, 2870, 2878, 2753, 2953, 3035, 2987, 2968, 2767, 2951, 2758, 2750, 2888, 2834, 2701, 2754],
                  54)
                }
                else if ( prop == "CG") {
                  paginaPopup(-0.228021, 15.827659, 'Congo',
                  [0.81, 0.85, 0.89, 1.07, 1.41, 1.81, 2.31, 2.45, 3.41, 2.72, 3.50, 4.38, 3.63, 4.12, 4.14, 2.51, 2.18, 2.49, 2.67],
                  [3496, 2845, 2943, 2824, 2825, 2873, 2853, 2904, 2942, 2978, 2887, 2764, 3165, 2867, 2872, 2861, 3014, 2943, 3705],
                  [0.81, 0.85, 0.89, 1.07, 1.41, 1.81, 2.31, 2.45, 3.41, 2.72, 3.50, 4.38, 3.63, 4.12, 4.14, 2.51, 2.18, 2.49, 3.28],
                  [3496, 2845, 2943, 2824, 2825, 2873, 2853, 2904, 2942, 2978, 2887, 2764, 3165, 2867, 2872, 2861, 3014, 2943, 3021],
                  110)
                }
                else if ( prop == "CD") {
                  paginaPopup(-4.038333, 21.758664, 'Congo RD',
                  [0.42, 0.16, 0.17, 0.18, 0.23, 0.27, 0.32, 0.36, 0.39, 0.32, 0.42, 0.51, 0.55, 0.60, 0.67, 0.71, 0.66, 0.67, 0.81],
                  [42268, 41887, 48849, 44888, 40798, 40652, 41400, 42944, 46860, 53646, 47397, 47250, 49219, 49941, 49726, 48886, 48749, 50895, 55962],
                  [0.42, 0.16, 0.17, 0.18, 0.23, 0.27, 0.32, 0.36, 0.39, 0.32, 0.42, 0.51, 0.55, 0.60, 0.67, 0.71, 0.66, 0.67, 0.82],
                  [42268, 41887, 48849, 44888, 40798, 40652, 41400, 42944, 46860, 53646, 47397, 47250, 49219, 49941, 49726, 48886, 48749, 50895, 55378],
                  27)
                }
                else if ( prop == "CU") {
                  paginaPopup(21.521757, -77.781167, 'Cuba',
                  [3.61, 3.92, 4.82, 4.79, 5.03, 5.48, 7.40, 8.23, 8.08, 7.85, 8.13, 8.91, 9.37, 9.23, 9.43, 9.91, 10.54, 10.66, 11.40],
                  [7655, 7322, 6952, 6781, 6880, 7047, 6453, 6450, 6818, 7162, 7161, 7010, 7056, 7549, 7717, 7933, 7706, 7737, 8405],
                  [3.61, 3.92, 4.82, 4.79, 5.03, 5.48, 7.40, 8.23, 8.08, 7.85, 8.13, 8.91, 9.37, 9.23, 9.43, 9.91, 10.54, 10.66, 11.60],
                  [7655, 7322, 6952, 6781, 6880, 7047, 6453, 6450, 6818, 7162, 7161, 7010, 7056, 7549, 7717, 7933, 7706, 7737, 8260],
                  42)
                }
                else if ( prop == "DK") {
                  paginaPopup(56.26392, 9.501785, 'Denmark',
                  [36.81, 43.00, 54.43, 59.65, 64.79, 66.09, 68.37, 73.74, 75.89, 81.32, 89.55, 91.26, 93.06, 94.07, 157.21, 142.05, 123.97, 127.51, 89.61],
                  [3356, 2468, 2596, 2547, 2435, 2589, 2672, 2503, 2438, 2213, 2059, 2160, 2092, 2051, 2039, 1920, 2232, 2289, 3583],
                  [36.81, 43.00, 54.43, 59.65, 64.79, 66.09, 68.37, 73.74, 75.89, 81.32, 89.55, 91.26, 93.06, 94.07, 157.21, 142.05, 123.97, 127.51, 137.98],
                  [3356, 2468, 2596, 2547, 2435, 2589, 2672, 2503, 2438, 2213, 2059, 2160, 2092, 2051, 2039, 1920, 2232, 2289, 2327],
                  57)
                }
                else if ( prop == "DM") {
                  paginaPopup(15.414999, -61.370976, 'Dominica',
                  [8.69, 8.88, 8.74, 8.57, 9.43, 9.32, 9.82, 9.31, 11.22, 11.66, 10.65, 11.35, 13.76, 10.11, 13.95, 14.26, 10.33, 12.43, 10.41],
                  [35, 35, 35, 37, 36, 36, 36, 41, 37, 38, 42, 40, 32, 45, 34, 34, 51, 41, 41],
                  [8.69, 8.88, 8.74, 8.57, 9.43, 9.32, 9.82, 9.31, 11.22, 11.66, 10.65, 11.35, 13.76, 10.11, 13.95, 14.26, 10.33, 12.43, 10.41],
                  [35, 35, 35, 37, 36, 36, 36, 41, 37, 38, 42, 40, 32, 45, 34, 34, 51, 41, 41],
                  181)
                }
                else if ( prop == "EC") {
                  paginaPopup(-1239, -78.183406, 'Ecuador',
                  [1.81, 2.45, 2.61, 2.84, 3.09, 3.28, 3.56, 3.74, 4.32, 4.30, 4.72, 5.48, 6.25, 7.05, 7.79, 7.71, 7.20, 7.89, 3.44],
                  [9198, 9280, 9932, 10350, 10764, 11480, 11936, 12367, 12967, 13195, 13362, 13134, 12773, 12252, 11850, 11688, 12423, 11855, 26104],
                  [1.81, 2.45, 2.61, 2.84, 3.09, 3.28, 3.56, 3.74, 4.32, 4.30, 4.72, 5.48, 6.25, 7.05, 7.79, 7.71, 7.20, 7.89, 7.44],
                  [9198, 9280, 9932, 10350, 10764, 11480, 11936, 12367, 12967, 13195, 13362, 13134, 12773, 12252, 11850, 11688, 12423, 11855, 12081],
                  142)
                }
                else if ( prop == "EG") {
                  paginaPopup(26.820553, 30.802498, 'Egypt',
                  [2.47, 2.29, 1.98, 1.84, 1.73, 1.96, 2.28, 2.87, 3.52, 3.99, 4.55, 4.73, 5.65, 5.63, 6.23, 6.60, 6.61, 4.57, 6,58],
                  [35910, 37713, 39321, 39871, 40448, 40550, 41837, 40264, 40988, 41981, 42542, 44175, 43759, 45374, 43449, 44657, 44615, 45655, 50229],
                  [2.47, 2.29, 1.98, 1.84, 1.73, 1.96, 2.28, 2.87, 3.52, 3.99, 4.55, 4.73, 5.65, 5.63, 6.23, 6.60, 6.61, 4.57, 7.75],
                  [35910, 37713, 39321, 39871, 40448, 40550, 41837, 40264, 40988, 41981, 42542, 44175, 43759, 45374, 43449, 44657, 44615, 45655, 42653],
                  87)
                }
                else if ( prop == "SV") {
                  paginaPopup(13.794185, -88.89653, 'El Salvador',
                  [1.62, 1.57, 1.71 , 1.87, 1.88, 1.90, 2.25, 2.20, 2.41, 2.32, 2.56, 2.83, 2.14, 2.21, 2.12, 2.06, 3.19, 3.33, 3.08],
                  [6552, 7483, 6198, 6353, 6729, 6930, 6348, 6899, 6648, 6743, 6410, 6350, 8850, 8811, 9386, 9890, 6599, 6545, 7277],
                  [1.62, 1.57, 1.71 , 1.87, 1.88, 1.90, 2.25, 2.20, 2.41, 2.32, 2.56, 2.83, 2.14, 2.21, 2.12, 2.06, 3.19, 3.33, 3.77],
                  [6552, 7483, 6198, 6353, 6729, 6930, 6348, 6899, 6648, 6743, 6410, 6350, 8850, 8811, 9386, 9890, 6599, 6545, 5950],
                  98)
                }
                else if ( prop == "AE") {
                  paginaPopup(23.424076, 53.847818, 'United Arab Emirates',
                  [50.00, 47.81, 47.84, 51.29, 54.96, 65.19, 77.80, 73.77, 72.09, 45.07, 50.31, 60.18, 62.56, 63.30, 63.70, 55.39, 53.96, 56.36, 44.73],
                  [1831, 1897, 2016, 2132, 2374, 2461, 2556, 3155, 3975, 5124, 5265, 5326, 5466, 5614, 5753, 5869, 6003, 6159, 7077],
                  [50.00, 47.81, 47.84, 51.29, 54.96, 65.19, 77.80, 73.77, 72.09, 45.07, 50.31, 60.18, 62.56, 63.30, 63.70, 55.39, 53.96, 56.36, 49.37],
                  [1831, 1897, 2016, 2132, 2374, 2461, 2556, 3155, 3975, 5124, 5265, 5326, 5466, 5614, 5753, 5869, 6003, 6159, 6412],
                  22)
                }
                else if ( prop == "ER") {
                  paginaPopup(15.179384,39.782334,'Eritrea',
                  [0.13, 0.20, 0.19, 0.21, 0.27, 0.26, 0.30, 0.33, 0.32, 0.45, 0.50, 0.63, 0.88, 1.32, 1.42, 1.53, 1.59, 1.76, 0.50],
                  [5113, 3417, 3600, 3873, 3894, 4072, 3863, 3902, 4190, 3993, 4107, 4043, 4022, 4124, 3990, 3977, 3983, 3956, 4020],
                  [0.13, 0.20, 0.19, 0.21, 0.27, 0.26, 0.30, 0.33, 0.32, 0.45, 0.50, 0.63, 0.88, 1.32, 1.42, 1.53, 1.59, 1.76, 0.50],
                  [5113, 3417, 3600, 3873, 3894, 4072, 3863, 3902, 4190, 3993, 4107, 4043, 4022, 4124, 3990, 3977, 3983, 3956, 4019],
                  149)
                }
                else if ( prop == "EE") {
                  paginaPopup(58.595272, 25.013607, 'Estonia',
                  [2.47, 2.49, 3.32, 4.87, 6.20, 7.72, 9.47, 12.55, 16.20, 13.91, 15.59, 18.55, 17.76, 22.78, 24.44, 23.68, 28.48, 31.68, 30.22],
                  [2092, 2330, 2009, 1837, 1766, 1648, 1628, 1612, 1358, 1284, 1135, 1134, 1179, 1003, 975, 863, 740, 737, 931],
                  [2.47, 2.49, 3.32, 4.87, 6.20, 7.72, 9.47, 12.55, 16.20, 13.91, 15.59, 18.55, 17.76, 22.78, 24.44, 23.68, 28.48, 31.68, 40.07],
                  [2092, 2330, 2009, 1837, 1766, 1648, 1628, 1612, 1358, 1284, 1135, 1134, 1179, 1003, 975, 863, 740, 737, 702],
                  113)
                }
                else if ( prop == "ET") {
                  paginaPopup(9.145, 40.489673, 'Ethiopia',
                  [0.08, 0.15, 0.15, 0.17, 0.21, 0.25, 0.31, 0.41, 0.56, 0.67, 0.64, 0.69, 0.94, 1.06, 1.24, 1.42, 1.57, 1.74, 2.15],
                  [98246, 46960, 45920, 45571, 44601, 44108, 44396, 43838, 43910, 43649, 42609, 41982, 41552, 40787, 40464, 41019, 41864, 41834, 45576],
                  [0.08, 0.15, 0.15, 0.17, 0.21, 0.25, 0.31, 0.41, 0.56, 0.67, 0.64, 0.69, 0.94, 1.06, 1.24, 1.42, 1.57, 1.74, 2.24],
                  [98246, 46960, 45920, 45571, 44601, 44108, 44396, 43838, 43910, 43649, 42609, 41982, 41552, 40787, 40464, 41019, 41864, 41834, 43658],
                  63)
                }
                else if ( prop == "FJ") {
                  paginaPopup(-16.578193, 179.4144133, 'Fiji',
                  [3.58, 5.35, 4.82, 6.15, 7.15, 6.54, 6.67, 8.78, 8.05, 8.40, 6.88, 10.95, 10.16, 9.24, 9.88, 9.66, 9.30, 11.22, 9.89],
                  [427, 292, 347, 342, 346, 417, 426, 352, 397, 310, 414, 313, 355, 412, 412, 410, 455, 408, 403],
                  [3.58, 5.35, 4.82, 6.15, 7.15, 6.54, 6.67, 8.78, 8.05, 8.40, 6.88, 10.95, 10.16, 9.24, 9.88, 9.66, 9.30, 11.22, 9.94],
                  [427, 292, 347, 342, 346, 417, 426, 352, 397, 310, 414, 313, 355, 412, 412, 410, 455, 408, 401],
                  158)
                }
                else if ( prop == "PH") {
                  paginaPopup(12.879721, 121.774017, 'Philippines',
                  [2.27, 2.19, 2.19, 2.24, 2.36, 2.65, 3.03, 3.93, 4.49, 4.19, 4.91, 5.54, 5.91, 5.42, 6.46, 6.28, 6.62, 6.78, 5.70],
                  [32355, 32856, 33617, 33966, 35070, 35206, 36531, 34382, 35522, 36267, 36646, 36437, 38091, 45116, 39592, 41856, 41370, 41490, 57692],
                  [2.27, 2.19, 2.19, 2.24, 2.36, 2.65, 3.03, 3.93, 4.49, 4.19, 4.91, 5.54, 5.91, 5.42, 6.46, 6.28, 6.62, 6.78, 6.79],
                  [32355, 32856, 33617, 33966, 35070, 35206, 36531, 34382, 35522, 36267, 36646, 36437, 38091, 45116, 39592, 41856, 41370, 41490, 48462],

                  108)
                }
                else if ( prop == "FI") {
                  paginaPopup(64.623548, 17.0935578, 'Finland',
                  [27.60, 28.08, 31.06, 37.64, 41.03, 43.20, 45.32, 54.60, 60.22, 55.01, 56.27, 64.33, 63.38, 68.14, 71.39, 70.82, 70.88, 87.27, 66.26],
                  [4128, 4166, 4077, 4125, 4353, 4295, 4337, 4245, 4277, 4150, 4000, 3866, 3683, 3605, 3477, 3297, 3072, 3144, 3732],
                  [27.60, 28.08, 31.06, 37.64, 41.03, 43.20, 45.32, 54.60, 60.22, 55.01, 56.27, 64.33, 63.38, 68.14, 71.39, 70.82, 70.88, 87.27, 78.73],
                  [4128, 4166, 4077, 4125, 4353, 4295, 4337, 4245, 4277, 4150, 4000, 3866, 3683, 3605, 3477, 3297, 3072, 3144, 3141],
                  70)
                }
                else if ( prop == "FR") {
                  paginaPopup(46.227638, 2.213749, 'France',
                  [29.09, 29.52, 32.24, 38.93, 49.79, 51.10, 55.27, 63.70, 69.21, 62.76, 61.42, 67.54, 63.90, 68.73, 71.27, 64.64, 53.72, 55.85, 20.84],
                  [41436, 41066, 40888, 41674, 37431, 37808, 36867, 36645, 37038, 37661, 37805, 37229, 36900, 35909, 35116, 40564, 40282, 40602, 110114],
                  [29.09, 29.52, 32.24, 38.93, 49.79, 51.10, 55.27, 63.70, 69.21, 62.76, 61.42, 67.54, 63.90, 68.73, 71.27, 64.64, 53.72, 55.85, 49.76],
                  [41436, 41066, 40888, 41674, 37431, 37808, 36867, 36645, 37038, 37661, 37805, 37229, 36900, 35909, 35116, 40564, 40282, 40602, 46110],
                  3)
                }
                else if ( prop == "GA") {
                  paginaPopup(-0.803689, 11.609444, 'Gabon',
                  [5.22, 5.04, 5.21, 6.18, 7.16, 8.71, 9.09, 10.47, 12.58, 10.00, 12.09, 14.98, 14.23, 14.14, 14.76, 11.51, 10.98, 11.76, 12.57],
                  [881, 901, 921, 947, 971, 980, 1005, 1043, 1073, 1040, 1013, 1024, 1006, 1025, 1006, 1013, 1032, 1004, 1129],
                  [5.22, 5.04, 5.21, 6.18, 7.16, 8.71, 9.09, 10.47, 12.58, 10.00, 12.09, 14.98, 14.23, 14.14, 14.76, 11.51, 10.98, 11.76, 13.33],
                  [881, 901, 921, 947, 971, 980, 1005, 1043, 1073, 1040, 1013, 1024, 1006, 1025, 1006, 1013, 1032, 1004, 1065],
                  119)
                }
                else if ( prop == "GM") {
                  paginaPopup(13.443182, -15.310139, 'Gambia',
                  [1.09, 0.93, 0.75, 0.63, 0.72, 0.70, 0.78, 0.88, 1.10 ,1.02, 1.05, 0.99, 0.96, 0.94, 0.85, 0.92, 0.96, 1.00, 1.87],
                  [652, 668, 694, 704, 730, 806, 763, 826, 799, 804, 822, 826, 864, 875, 891, 903, 916, 933, 927],
                  [1.09, 0.93, 0.75, 0.63, 0.72, 0.70, 0.78, 0.88, 1.10 ,1.02, 1.05, 0.99, 0.96, 0.94, 0.85, 0.92, 0.96, 1.00, 2.15],
                  [652, 668, 694, 704, 730, 806, 763, 826, 799, 804, 822, 826, 864, 875, 891, 903, 916, 933, 803],
                  164)
                }
                else if ( prop == "GE") {
                  paginaPopup(42.315407, 43.356892, 'Georgia',
                  [2.41, 2.62, 1.75, 2.26, 2.60, 5.02, 5.95, 7.33, 5.77, 4.96, 5.27, 6.48, 6.80, 6.98, 7.24, 5.84, 6.04, 6.49, 3.38],
                  [1237, 1265, 1870, 1706, 1910, 1238, 1266, 1354, 2168, 2129, 2171, 2190, 2290, 2270, 2239, 2340, 2310, 2266, 4594],
                  [2.41, 2.62, 1.75, 2.26, 2.60, 5.02, 5.95, 7.33, 5.77, 4.96, 5.27, 6.48, 6.80, 6.98, 7.24, 5.84, 6.04, 6.49, 7.44],
                  [1237, 1265, 1870, 1706, 1910, 1238, 1266, 1354, 2168, 2129, 2171, 2190, 2290, 2270, 2239, 2340, 2310, 2266, 2089],
                  89)
                }
                else if ( prop == "DE") {
                  paginaPopup(51.165691, 10.451526, 'Germany',
                  [51.06, 52.18, 54.49, 64.94, 75.79, 77.47, 83.06, 100.11, 106.17, 95.80, 91.57, 103.58, 97.73, 99.67, 105.18, 91.36, 78.93, 83.95, 47.84],
                  [34523, 34201, 34296, 34606, 33309, 33024, 32280, 30650, 31511, 31832, 33312, 32988, 32931, 34133, 34667, 36496, 39179, 38762, 72872],
                  [51.06, 52.18, 54.49, 64.94, 75.79, 77.47, 83.06, 100.11, 106.17, 95.80, 91.57, 103.58, 97.73, 99.67, 105.18, 91.36, 78.93, 83.95, 87.59],
                  [34523, 34201, 34296, 34606, 33309, 33024, 32280, 30650, 31511, 31832, 33312, 32988, 32931, 34133, 34667, 36496, 39179, 38762, 39801],
                  48)
                }
                else if ( prop == "GH") {
                  paginaPopup(7.946527,-1.023194, 'Ghana',
                  [0.46, 0.46, 0.52, 0.62, 0.70, 0.82, 1.50, 1.81, 2.08, 1.86, 2.25, 2.71, 2.81, 3.13, 2.48, 2.26, 2.53, 2.80, 4.53],
                  [9697, 10332, 10721, 11038, 11440, 11814, 12223, 12315, 12322, 12606, 12865, 13159, 13430, 13783, 14187, 14914, 15285, 15254, 14521],
                  [0.46, 0.46, 0.52, 0.62, 0.70, 0.82, 1.50, 1.81, 2.08, 1.86, 2.25, 2.71, 2.81, 3.13, 2.48, 2.26, 2.53, 2.80, 4.64],
                  [9697, 10332, 10721, 11038, 11440, 11814, 12223, 12315, 12322, 12606, 12865, 13159, 13430, 13783, 14187, 14914, 15285, 15254, 14186],
                  34)
                }
                else if ( prop == "JM") {
                  paginaPopup(18.109581, -77.297508, 'Jamaica',
                  [7.79, 7.43, 9.13, 9.76, 11.04, 9.43, 9.71, 8.55, 7.80, 6.09, 8.40, 7.74, 7.39, 7.21, 6.96, 6.98, 7.30, 7.84, 9.43],
                  [1025, 1115, 942, 854, 815, 1052, 1085, 1327, 1550, 1745, 1387, 1648, 1767, 1748, 1763, 1795, 1700, 1663, 1333],
                  [7.79, 7.43, 9.13, 9.76, 11.04, 9.43, 9.71, 8.55, 7.80, 6.09, 8.40, 7.74, 7.39, 7.21, 6.96, 6.98, 7.30, 7.84, 12.19],
                  [1025, 1115, 942, 854, 815, 1052, 1085, 1327, 1550, 1745, 1387, 1648, 1767, 1748, 1763, 1795, 1700, 1663, 1031],
                  166)
                }
                else if ( prop == "JP") {
                  paginaPopup(36.204824, 138.252924, 'Japan',
                  [59.56, 53.24, 50.45, 52.84, 47.53, 56.90, 55.92, 55.18, 61.82, 64.15, 67.70, 59.11, 76.33, 64.96, 63.05, 58.48, 63.17, 61.76, 66.31],
                  [73805, 73131, 73327, 75638, 91238, 75380, 73112, 73826, 73523, 73598, 75965, 94114, 73469, 71767, 69549, 67905, 70729, 71682, 74507],
                  [59.56, 53.24, 50.45, 52.84, 47.53, 56.90, 55.92, 55.18, 61.82, 64.15, 67.70, 59.11, 76.33, 64.96, 63.05, 58.48, 63.17, 61.76, 69.50],
                  [73805, 73131, 73327, 75638, 91238, 75380, 73112, 73826, 73523, 73598, 75965, 94114, 73469, 71767, 69549, 67905, 70729, 71682, 71039],
                  40)
                }
                else if ( prop == "DJ") {
                  paginaPopup(11.825138, 42.590275, 'Djibouti',
                  [1.33, 1.37, 1.39, 1.45, 1.38, 1.64, 1.35, 1.92, 2.03, 2.23, 2.43, 2.63, 2.84, 2.71, 2.96, 3.14, 3.51, 3.13, 4.17],
                  [414, 417, 425, 429, 484, 433, 569, 442, 491, 470, 464, 471, 476, 488, 492, 520, 503, 511, 738],
                  [1.33, 1.37, 1.39, 1.45, 1.38, 1.64, 1.35, 1.92, 2.03, 2.23, 2.43, 2.63, 2.84, 2.71, 2.96, 3.14, 3.51, 3.13, 4.55],
                  [414, 417, 425, 429, 484, 433, 569, 442, 491, 470, 464, 471, 476, 488, 492, 520, 503, 511, 677],
                  105)
                }
                else if ( prop == "JO") {
                  paginaPopup(30.585164, 36.238414, 'Jordan',
                  [3.70, 3.90, 4.29, 4.56, 5.16, 5.26, 6.37, 7.27, 9.23, 10.13, 11.06, 11.84, 12.12, 12.37, 12.53, 12.47, 11.94, 11.00, 5.86],
                  [2138, 2152, 2088, 2089, 2067, 2232, 2201, 2190, 2204, 2159, 2168, 2174, 2235, 2329, 2406, 2495, 2653, 2690, 6782],
                  [3.70, 3.90, 4.29, 4.56, 5.16, 5.26, 6.37, 7.27, 9.23, 10.13, 11.06, 11.84, 12.12, 12.37, 12.53, 12.47, 11.94, 11.00, 13.40],
                  [2138, 2152, 2088, 2089, 2067, 2232, 2201, 2190, 2204, 2159, 2168, 2174, 2235, 2329, 2406, 2495, 2653, 2690, 2967],
                  20)
                }
                else if ( prop == "GR") {
                  paginaPopup(39.074208, 21.824312, 'Greece',
                  [25.89, 28.45, 32.69, 42.91, 52.92, 52.78, 60.63, 67.19, 79.11, 74.71, 70.13, 75.76, 58.14, 59.32, 59.88, 42.74, 46.25, 48.66, 19.24],
                  [4636, 4406, 4325, 4322, 4171, 4304, 4131, 4346, 4108, 4046, 3904, 3472, 3868, 3710, 3638, 4215, 3842, 3792, 8712],
                  [25.89, 28.45, 32.69, 42.91, 52.92, 52.78, 60.63, 67.19, 79.11, 74.71, 70.13, 75.76, 58.14, 59.32, 59.88, 42.74, 46.25, 48.66, 43.16],
                  [4636, 4406, 4325, 4322, 4171, 4304, 4131, 4346, 4108, 4046, 3904, 3472, 3868, 3710, 3638, 4215, 3842, 3792, 3885],
                  140)
                }
                else if ( prop == "GD") {
                  paginaPopup(12.262776, -61.604171, 'Grenada',
                  [10.29, 10.52, 11.44, 13.45, 8.79, 11.10, 12.72, 13.81, 15.03, 13.76, 12.76, 12.88, 13.48, 13.94, 14.81, 15.38, 16.57, 17.26, 19.56],
                  [46, 45, 43, 40, 62, 57, 50, 50, 50, 51, 55, 55, 54, 55, 56, 59, 58, 59, 51],
                  [10.29, 10.52, 11.44, 13.45, 8.79, 11.10, 12.72, 13.81, 15.03, 13.76, 12.76, 12.88, 13.48, 13.94, 14.81, 15.38, 16.57, 17.26, 19.96],
                  [46, 45, 43, 40, 62, 57, 50, 50, 50, 51, 55, 55, 54, 55, 56, 59, 58, 59, 50],
                  197)
                }
                else if ( prop == "GT") {
                  paginaPopup(15.783471,-90.230759, 'Guatemala',
                  [2.02, 1.84, 2.05, 2.14, 2.12, 2.17, 2.23, 2.70, 2.89, 2.57, 2.91, 3.47, 3.75, 3.99, 4.44, 4.46, 4.53, 4.80, 3.75],
                  [8718, 9313, 9250, 9382, 10354, 11505, 12414, 11589, 12402, 13439, 13022, 12599, 12322, 12357, 12102, 13074, 13881, 14404, 20019],
                  [2.02, 1.84, 2.05, 2.14, 2.12, 2.17, 2.23, 2.70, 2.89, 2.57, 2.91, 3.47, 3.75, 3.99, 4.44, 4.46, 4.53, 4.80, 4.93],
                  [8718, 9313, 9250, 9382, 10354, 11505, 12414, 11589, 12402, 13439, 13022, 12599, 12322, 12357, 12102, 13074, 13881, 14404, 15216],
                  64)
                }
                else if ( prop == "GN") {
                  paginaPopup(9.945587, -9.696645, 'Guinea',
                  [0.36, 0.37, 0.43, 0.50, 0.52, 0.42, 0.61, 0.79, 0.98, 0.87, 0.97, 0.89, 1.03, 1.10, 1.18, 1.20, 1.27, 1.43, 1.87],
                  [7650, 6895, 6225, 6217, 6385, 6305, 6534, 6750, 6567, 6870, 6706, 6793, 6824, 7079, 7019, 7018, 6951, 6957, 7623],
                  [0.36, 0.37, 0.43, 0.50, 0.52, 0.42, 0.61, 0.79, 0.98, 0.87, 0.97, 0.89, 1.03, 1.10, 1.18, 1.20, 1.27, 1.43, 1.89],
                  [7650, 6895, 6225, 6217, 6385, 6305, 6534, 6750, 6567, 6870, 6706, 6793, 6824, 7079, 7019, 7018, 6951, 6957, 7543],
                  80)
                }
                else if ( prop == "GW") {
                  paginaPopup(11.803749, -15.180413, 'Guinea-Bissau',
                  [0.31, 0.32, 0.35, 0.40, 0.44, 0.50, 0.48, 0.55, 0.70, 0.63, 0.67, 0.89, 0.80, 0.85, 0.82, 0.83, 0.94, 1.08, 1.00],
                  [1153, 1167, 1157, 1153, 1156, 1129, 1176, 1217, 1191, 1262, 1205, 1174, 1185, 1176, 1223, 1190, 1187, 1181, 1303],
                  [0.31, 0.32, 0.35, 0.40, 0.44, 0.50, 0.48, 0.55, 0.70, 0.63, 0.67, 0.89, 0.80, 0.85, 0.82, 0.83, 0.94, 1.08, 1.04],
                  [1153, 1167, 1157, 1153, 1156, 1129, 1176, 1217, 1191, 1262, 1205, 1174, 1185, 1176, 1223, 1190, 1187, 1181, 1258],
                  33)
                }
                else if ( prop == "GQ") {
                  paginaPopup(1.650801, 10.267895, 'Equatorial Guinea',
                  [1.59, 2.35, 3.06, 4.24, 7.81, 12.14, 16.12, 20.54, 29.34, 22.39, 23.97, 32.72, 33.66, 32.71, 30.08, 17.89, 14.62, 15.54, 14.38],
                  [517, 485, 457, 451, 430, 509, 464, 465, 484, 475, 474, 448, 451, 449, 478, 482, 499, 516, 634],
                  [1.59, 2.35, 3.06, 4.24, 7.81, 12.14, 16.12, 20.54, 29.34, 22.39, 23.97, 32.72, 33.66, 32.71, 30.08, 17.89, 14.62, 15.54, 16.64],
                  [517, 485, 457, 451, 430, 509, 464, 465, 484, 475, 474, 448, 451, 449, 478, 482, 499, 516, 548],
                  101)
                }
                else if ( prop == "GY") {
                  paginaPopup(4.860416, -58.93018, 'Guyana',
                  [1.00, 0.98, 0.99, 0.93, 1.05, 1.06, 1.74, 2.26, 2.39, 2.91, 2.81, 3.09, 3.43, 3.39, 3.91, 4.11, 4.65, 4.96, 4.82],
                  [636, 640, 659, 718, 670, 697, 755, 699, 734, 649, 744, 766, 764, 805, 717, 699, 684, 671, 1033],
                  [1.00, 0.98, 0.99, 0.93, 1.05, 1.06, 1.74, 2.26, 2.39, 2.91, 2.81, 3.09, 3.43, 3.39, 3.91, 4.11, 4.65, 4.96, 5.73],
                  [636, 640, 659, 718, 670, 697, 755, 699, 734, 649, 744, 766, 764, 805, 717, 699, 684, 671, 869],
                  99)
                }
                else if ( prop == "HT") {
                  paginaPopup(18.971187, -72.285215, 'Haiti',
                  [0.36, 0.33, 0.32, 0.27, 0.25, 0.38, 0.42, 0.50, 0.52, 0.56, 0.03, 0.64, 0.66, 0.71, 0.73, 0.73, 0.63, 0.69, 1.09],
                  [9939, 9937, 9926, 10077, 12923, 10268, 10410, 10614, 11416, 10789, 233397, 10740, 10852, 10830, 10981, 10911, 11497, 11068, 11170],
                  [0.36, 0.33, 0.32, 0.27, 0.25, 0.38, 0.42, 0.50, 0.52, 0.56, 0.03, 0.64, 0.66, 0.71, 0.73, 0.73, 0.63, 0.69, 1.12],
                  [9939, 9937, 9926, 10077, 12923, 10268, 10410, 10614, 11416, 10789, 233397, 10740, 10852, 10830, 10981, 10911, 11497, 11068, 10934],
                  93)
                }
                else if ( prop == "HN") {
                  paginaPopup(15.199999, -86.241905, 'Honduras',
                  [1.13, 1.18, 1.20, 1.21, 1.27, 1.41, 1.54, 1.69, , 1.90, 1.96, 2.21, 1.32, 1.38, 1.44, 1.45, 2.53, 2.66, 2.23],
                  [5496, 5556, 5586, 5764, 5884, 5836, 5970, 6122, 6330, 6418, 6745, 6655, 11578, 11058, 11261, 11890, 6998, 7040, 9705],
                  [1.13, 1.18, 1.20, 1.21, 1.27, 1.41, 1.54, 1.69, , 1.90, 1.96, 2.21, 1.32, 1.38, 1.44, 1.45, 2.53, 2.66, 3.29],
                  [5496, 5556, 5586, 5764, 5884, 5836, 5970, 6122, 6330, 6418, 6745, 6655, 11578, 11058, 11261, 11890, 6998, 7040, 6594],
                  125)
                }
                else if ( prop == "IN") {
                  paginaPopup(20.593684, 78.96288, 'India',
                  [0.49, 0.50, 0.54, 0.65, 0.74, 0.85, 0.95, 1.23, 1.18, 1.28, 1.56, 1.68, 1.68, 1.72, 1.92, 2.00, 2.13, 2.43, 2.18],
                  [858888, 877679, 851431, 839164, 855338, 866901, 877474, 891894, 917815, 939646, 964989, 988161, 987840, 984862, 969760, 960116, 973223, 977117, 1093482],
                  [0.49, 0.50, 0.54, 0.65, 0.74, 0.85, 0.95, 1.23, 1.18, 1.28, 1.56, 1.68, 1.68, 1.72, 1.92, 2.00, 2.13, 2.43, 2.53],
                  [858888, 877679, 851431, 839164, 855338, 866901, 877474, 891894, 917815, 939646, 964989, 988161, 987840, 984862, 969760, 960116, 973223, 977117, 944744],
                  95)
                }
                else if ( prop == "ID") {
                  paginaPopup(-0.789275, 113.921327, 'Indonesia',
                  [1.35, 1.31, 1.64, 1.99, 0.86, 2.50, 3.01, 3.79, 4.68, 5.00, 7.25, 8.85, 9.22, 9.27, 9.15, 8.96, 9.77, 10.64, 9.00],
                  [111551, 111597, 108529, 107178, 270168, 103828, 109816, 103342, 98861, 97897, 94371, 91440, 90297, 89345, 88381, 87255, 86688, 86670, 108048],
                  [1.35, 1.31, 1.64, 1.99, 0.86, 2.50, 3.01, 3.79, 4.68, 5.00, 7.25, 8.85, 9.22, 9.27, 9.15, 8.96, 9.77, 10.64, 11.34],
                  [111551, 111597, 108529, 107178, 270168, 103828, 109816, 103342, 98861, 97897, 94371, 91440, 90297, 89345, 88381, 87255, 86688, 86670, 84910],
                  7)
                }
                else if ( prop == "IR") {
                  paginaPopup(32.427908, 53.688046, 'Iran',
                  [1.98, 2.24, 2.25, 1.75, 3.20, 3.82, 4.53, 5.93, 6.92, 7.15, 8.56, 10.52, 11.06, 8.94, 8.75, 8.01, 9.01, 9.37, 1.81],
                  [50030, 51321, 51837, 79446, 53853, 53647, 53278, 53450, 53172, 52463, 51558, 50290, 49075, 47406, 45031, 43702, 42191, 42562, 96286],
                  [1.98, 2.24, 2.25, 1.75, 3.20, 3.82, 4.53, 5.93, 6.92, 7.15, 8.56, 10.52, 11.06, 8.94, 8.75, 8.01, 9.01, 9.37, 4.24],
                  [50030, 51321, 51837, 79446, 53853, 53647, 53278, 53450, 53172, 52463, 51558, 50290, 49075, 47406, 45031, 43702, 42191, 42562, 41191],
                  61)
                }
                else if ( prop == "IQ") {
                  paginaPopup(33.223191, 43.679291, 'Iraq',
                  [1.13, 0.86, 0.82, 0.66, 1.46, 1.84, 1.39, 1.82, 4.39, 4.25, 7.52, 7.15, 8.04, 6.28, 4.29, 3.92, 3.60, 3.75, 3.89],
                  [20803, 20114, 21007, 21392, 22909, 24772, 42534, 44572, 27359, 23996, 24392, 23756, 24801, 34208, 50127, 42089, 43691, 48501, 39162],
                  [1.13, 0.86, 0.82, 0.66, 1.46, 1.84, 1.39, 1.82, 4.39, 4.25, 7.52, 7.15, 8.04, 6.28, 4.29, 3.92, 3.60, 3.75, 5.77],
                  [20803, 20114, 21007, 21392, 22909, 24772, 42534, 44572, 27359, 23996, 24392, 23756, 24801, 34208, 50127, 42089, 43691, 48501, 26354],
                  53)
                }
                else if ( prop == "IE") {
                  paginaPopup(53.41291, -8.24389, 'Ireland',
                  [58.13, 60.81, 73.30, 103.75, 125.75, 123.26, 143.38, 139.31, 145.12, 114.12, 127.74, 130.51, 132.10, 147.61, 154.08, 211.98, 224.65, 241.83, 109.23],
                  [1578, 1648, 1603, 1457, 1420, 1579, 1480, 1759, 1721, 1894, 1601, 1693, 1577, 1491, 1530, 1244, 1224, 1239, 3448],
                  [58.13, 60.81, 73.30, 103.75, 125.75, 123.26, 143.38, 139.31, 145.12, 114.12, 127.74, 130.51, 132.10, 147.61, 154.08, 211.98, 224.65, 241.83, 308.20],
                  [1578, 1648, 1603, 1457, 1420, 1579, 1480, 1759, 1721, 1894, 1601, 1693, 1577, 1491, 1530, 1244, 1224, 1239, 1222],
                  81)
                }
                else if ( prop == "IS") {
                  paginaPopup(64.963051, -19.020835, 'Iceland',
                  [61.08, 70.96, 74.64, 101.07, 120.49, 146.06, 105.97, 159.82, 125.56, 98.52, 88.41, 116.31, 108.39, 130.46, 129.04, 134.67, 156.20, 177.60, 131.44],
                  [133, 104, 112, 102, 104, 104, 145, 119, 125, 118, 137, 116, 121, 109, 122, 114, 117, 120, 140],
                  [61.08, 70.96, 74.64, 101.07, 120.49, 146.06, 105.97, 159.82, 125.56, 98.52, 88.41, 116.31, 108.39, 130.46, 129.04, 134.67, 156.20, 177.60, 165.78],
                  [133, 104, 112, 102, 104, 104, 145, 119, 125, 118, 137, 116, 121, 109, 122, 114, 117, 120, 111],
                  126)
                }
                else if ( prop == "MH") {
                  paginaPopup(7.131474, 171.184478, 'Marshall Islands',
                  [2.35, 2.38, 2.47, 2.46, 2.54, 2.61, 2.73, 2.86, 2.90, 2.89, 3.13, 3.35, 3.59, 3.77, 3.81, 3.55, 3.93, 4.03, 5.25],
                  [43, 44, 46, 47, 47, 48, 48, 48, 48, 48, 48, 47, 47, 46, 46, 46, 45, 45, 43],
                  [2.35, 2.38, 2.47, 2.46, 2.54, 2.61, 2.73, 2.86, 2.90, 2.89, 3.13, 3.35, 3.59, 3.77, 3.81, 3.55, 3.93, 4.03, 5.25],
                  [43, 44, 46, 47, 47, 48, 48, 48, 48, 48, 48, 47, 47, 46, 46, 46, 45, 45, 43],
                  209)
                }
                else if ( prop == "SB") {
                  paginaPopup(-9.64571, 160.156194, 'Solomon Islands',
                  [0.96, 0.91, 0.76, 0.73, 0.81, 0.87, 0.95, 0.94, 1.22, 1.13, 1.32, 1.80, 2.04, 2.09, 1.99, 2.08, 2.23, 2.32, 2.15],
                  [414, 399, 410, 417, 421, 430, 437, 499, 453, 480, 469, 471, 473, 490, 532, 503, 499, 506, 657],
                  [0.96, 0.91, 0.76, 0.73, 0.81, 0.87, 0.95, 0.94, 1.22, 1.13, 1.32, 1.80, 2.04, 2.09, 1.99, 2.08, 2.23, 2.32, 2.15],
                  [414, 399, 410, 417, 421, 430, 437, 499, 453, 480, 469, 471, 473, 490, 532, 503, 499, 506, 657],
                  73)
                }
                else if ( prop == "IL") {
                  paginaPopup(31.046051, 34.851612, 'Israel',
                  [54.55, 49.86, 42.97, 50.39, 55.01, 58.58, 68.46, 82.59, 93.63, 95.04, 104.45, 120.83, 126.46, 147.28, 154.90, 146.56, 119.37, 129.74, 59.20],
                  [2111, 2271, 2435, 2175, 2129, 2109, 1960, 1898, 2036, 1927, 1981, 1919, 1801, 1753, 1751, 1787, 2322, 2351, 5803],
                  [54.55, 49.86, 42.97, 50.39, 55.01, 58.58, 68.46, 82.59, 93.63, 95.04, 104.45, 120.83, 126.46, 147.28, 154.90, 146.56, 119.37, 129.74, 141.32],
                  [2111, 2271, 2435, 2175, 2129, 2109, 1960, 1898, 2036, 1927, 1981, 1919, 1801, 1753, 1751, 1787, 2322, 2351, 2431],
                  137)
                }
                else if ( prop == "IT") {
                  paginaPopup(41.2036156, 8.2238657, 'Italy',
                  [39.95, 39.84, 43.63, 56.28, 68.93, 70.89, 73.39, 82.95, 90.19, 81.20, 80.89, 87.87, 79.60, 81.89, 83.90, 68.63, 69.68, 73.55, 17.53],
                  [26100, 26727, 26693, 25684, 24015, 24065, 24407, 24459, 24325, 24642, 24031, 23693, 23775, 23494, 22888, 23928, 23952, 23641, 99437],
                  [39.95, 39.84, 43.63, 56.28, 68.93, 70.89, 73.39, 82.95, 90.19, 81.20, 80.89, 87.87, 79.60, 81.89, 83.90, 68.63, 69.68, 73.55, 67.46],
                  [26100, 26727, 26693, 25684, 24015, 24065, 24407, 24459, 24325, 24642, 24031, 23693, 23775, 23494, 22888, 23928, 23952, 23641, 25833],
                  28)
                }
                else if ( prop == "KZ") {
                  paginaPopup(48.019573,66.923684, 'Kazakhstan',
                  [0.96, 0.94, 1.09, 1.34, 1.81, 2.37, 3.27, 4.32, 6.26, 6.08, 7.98, 10.32, 11.49, 13.09, 13.38, 12.40, 9.24, 10.62, 9.36],
                  [17385, 21614, 20693, 21326, 22128, 22403, 23005, 22488, 19693, 17258, 16866, 16990, 16497, 16511, 15136, 13591, 13563, 13682, 16526],
                  [0.96, 0.94, 1.09, 1.34, 1.81, 2.37, 3.27, 4.32, 6.26, 6.08, 7.98, 10.32, 11.49, 13.09, 13.38, 12.40, 9.24, 10.62, 11.22],
                  [17385, 21614, 20693, 21326, 22128, 22403, 23005, 22488, 19693, 17258, 16866, 16990, 16497, 16511, 15136, 13591, 13563, 13682, 13787],
                  151)
                }
                else if ( prop == "KE") {
                  paginaPopup(-0.023559, 37.906193, 'Kenya',
                  [0.69, 0.71, 0.71, 0.79, 0.83, 0.92, 1.21, 1.45, 1.48, 1.64, 1.73, 1.78, 2.08, 2.25, 2.57, 2.64, 2.95, 3.02, 4.06],
                  [16481, 16338, 16537, 16968, 17395, 18205, 18975, 19575, 21600, 20052, 20563, 20862, 21486, 21678, 21177, 21548, 21305, 22053, 22130],
                  [0.69, 0.71, 0.71, 0.79, 0.83, 0.92, 1.21, 1.45, 1.48, 1.64, 1.73, 1.78, 2.08, 2.25, 2.57, 2.64, 2.95, 3.02, 4.40],
                  [16481, 16338, 16537, 16968, 17395, 18205, 18975, 19575, 21600, 20052, 20563, 20862, 21486, 21678, 21177, 21548, 21305, 22053, 20463],
                  18)
                }
                else if ( prop == "KG") {
                  paginaPopup(41.1355977, 70.2512566, 'Kyrgyzstan',
                  [0.37, 0.43, 0.43, 0.48, 0.56, 0.60, 0.67, 0.92, 1.23, 1.23, 1.11, 1.57, 1.74, 2.12, 2.19, 1.95, 2.22, 2.44, 1.58],
                  [3434, 3261, 3447, 3665, 3601, 3682, 3831, 3730, 3789, 3468, 3954, 3617, 3475, 3156, 3107, 3108, 2771, 2781, 4209],
                  [0.37, 0.43, 0.43, 0.48, 0.56, 0.60, 0.67, 0.92, 1.23, 1.23, 1.11, 1.57, 1.74, 2.12, 2.19, 1.95, 2.22, 2.44, 2.34],
                  [3434, 3261, 3447, 3665, 3601, 3682, 3831, 3730, 3789, 3468, 3954, 3617, 3475, 3156, 3107, 3108, 2771, 2781, 2854],
                  72)
                }
                else if ( prop == "KI") {
                  paginaPopup(-3.370417, -168.734039, 'Kiribati',
                  [3.83, 1.04, 1.19, 1.47, 1.63, 1.76, 1.67, 1.92, 2.01, 1.86, 2.15, 2.44, 2.59, 2.54, 2.43, 2.30, 2.47, 2.66, 2.38],
                  [16, 55, 55, 56, 57, 58, 59, 62, 63, 64, 65, 66, 66, 67, 67, 67, 67, 67, 76],
                  [3.83, 1.04, 1.19, 1.47, 1.63, 1.76, 1.67, 1.92, 2.01, 1.86, 2.15, 2.44, 2.59, 2.54, 2.43, 2.30, 2.47, 2.66, 2.38],
                  [16, 55, 55, 56, 57, 58, 59, 62, 63, 64, 65, 66, 66, 67, 67, 67, 67, 67, 76],
                  183)
                }
                else if ( prop == "KW") {
                  paginaPopup(29.31166, 47.481766, 'Kuwait',
                  [49.00, 45.52, 45.98, 57.83, 59.17, 87.87, 109.54, 119.94, 160.57, 103.68, 127.60, 173.30, 178.24, 180.48, 160.66, 106.51, 105.50, 110.90, 48.98],
                  [659, 658, 719, 728, 897, 832, 848, 882, 852, 950, 840, 821, 895, 877, 914, 968, 946, 977, 2007],
                  [49.00, 45.52, 45.98, 57.83, 59.17, 87.87, 109.54, 119.94, 160.57, 103.68, 127.60, 173.30, 178.24, 180.48, 160.66, 106.51, 105.50, 110.90, 91.55],
                  [659, 658, 719, 728, 897, 832, 848, 882, 852, 950, 840, 821, 895, 877, 914, 968, 946, 977, 1074],
                  159)
                }
                else if ( prop == "LA") {
                  paginaPopup(19.85627, 102.495496, 'Laos',
                  [0.30, 0.31, 0.31, 0.36, 0.42, 0.49, 0.62, 0.78, 1.01, 1.10, 1.38, 1.72, 2.07, 2.44, 2.81, 3.08, 3.45, 3.75, 4.95],
                  [5237, 5169, 5157, 5168, 5110, 5054, 5064, 4888, 4910, 4839, 4707, 4642, 4528, 4514, 4364, 4342, 4270, 4195, 3517],
                  [0.30, 0.31, 0.31, 0.36, 0.42, 0.49, 0.62, 0.78, 1.01, 1.10, 1.38, 1.72, 2.07, 2.44, 2.81, 3.08, 3.45, 3.75, 4.95],
                  [5237, 5169, 5157, 5168, 5110, 5054, 5064, 4888, 4910, 4839, 4707, 4642, 4528, 4514, 4364, 4342, 4270, 4195, 3517],
                  138)
                }
                else if ( prop == "LS") {
                  paginaPopup(-29.609988, 28.233608, 'Lesotho',
                  [0.31, 0.28, 0.25, 0.36, 0.46, 0.50, 0.54, 0.53, 0.55, 0.56, 0.72, 0.84, 0.81, 0.77, 0.80, 0.77, 0.73, 0.86, 0.53],
                  [2549, 2647, 2781, 2873, 2954, 2996, 3019, 3064, 3052, 3002, 2972, 2981, 2961, 2948, 2938, 2912, 2817, 2725, 3156],
                  [0.31, 0.28, 0.25, 0.36, 0.46, 0.50, 0.54, 0.53, 0.55, 0.56, 0.72, 0.84, 0.81, 0.77, 0.80, 0.77, 0.73, 0.86, 0.54],
                  [2549, 2647, 2781, 2873, 2954, 2996, 3019, 3064, 3052, 3002, 2972, 2981, 2961, 2948, 2938, 2912, 2817, 2725, 3106],
                  102)
                }
                else if ( prop == "LV") {
                  paginaPopup(56.860093, 22.3021037, 'Latvia',
                  [1.92, 2.06, 2.38, 3.17, 4.10, 4.96, 5.71, 9.74, 13.00, 10.91, 10.22, 13.99, 13.56, 15.26, 15.21, 13.94, 15.46, 17.19, 14.39],
                  [3773, 3703, 3666, 3373, 3181, 3216, 3240, 2850, 2453, 2158, 2108, 1840, 1889, 1803, 1870, 1754, 1620, 1605, 2102],
                  [1.92, 2.06, 2.38, 3.17, 4.10, 4.96, 5.71, 9.74, 13.00, 10.91, 10.22, 13.99, 13.56, 15.26, 15.21, 13.94, 15.46, 17.19, 20.49],
                  [3773, 3703, 3666, 3373, 3181, 3216, 3240, 2850, 2453, 2158, 2108, 1840, 1889, 1803, 1870, 1754, 1620, 1605, 1476],
                  58)
                }
                else if ( prop == "LB") {
                  paginaPopup(33.854721, 35.862285, 'Lebanon',
                  [9.16, 9.89, 10.67, 11.19, 11.96, 11.93, 8.37, 12.15, 13.69, 18.31, 19.34, 20.55, 19.94, 16.91, 17.27, 17.89, 19.97, 18.14, 10.66],
                  [1715, 1624, 1634, 1633, 1594, 1624, 2369, 1840, 1942, 1763, 1808, 1776, 2005, 2482, 2525, 2516, 2253, 2582, 2849],
                  [9.16, 9.89, 10.67, 11.19, 11.96, 11.93, 8.37, 12.15, 13.69, 18.31, 19.34, 20.55, 19.94, 16.91, 17.27, 17.89, 19.97, 18.14, 21.61],
                  [1715, 1624, 1634, 1633, 1594, 1624, 2369, 1840, 1942, 1763, 1808, 1776, 2005, 2482, 2525, 2516, 2253, 2582, 1406],
                  147)
                }
                else if ( prop == "LR") {
                  paginaPopup(6.428055, -9.429499, 'Liberia',
                  [0.28, 0.23, 0.13, 0.08, 0.29, 0.34, 0.37, 0.44, 0.50, 0.66, 0.70, 0.80, 0.87, 0.96, 1.01, 1.03, 1.06, 1.09, 1.51],
                  [1742, 2081, 3880, 4690, 1471, 1495, 1495, 1518, 1565, 1600, 1686, 1756, 1819, 1855, 1823, 1795, 1812, 1793, 1775],
                  [0.28, 0.23, 0.13, 0.08, 0.29, 0.34, 0.37, 0.44, 0.50, 0.66, 0.70, 0.80, 0.87, 0.96, 1.01, 1.03, 1.06, 1.09, 1.59],
                  [1742, 2081, 3880, 4690, 1471, 1495, 1495, 1518, 1565, 1600, 1686, 1756, 1819, 1855, 1823, 1795, 1812, 1793, 1692],
                  130)
                }
                else if ( prop == "LY") {
                  paginaPopup(26.3351, 17.228331, 'Libya',
                  [9.34, 9.57, 9.44, 9.95, 9.79, 13.44, 17.26, 20.95, 21.57, 19.79, 20.41, 0.51, 14.49, 15.56, 5.92, 6.20, 3.78, 5.58, 3.65],
                  [2708, 2681, 2754, 2650, 2728, 2693, 2668, 2699, 3117, 3409, 3420, 51420, 4557, 3973, 7435, 5354, 7112, 5710, 6344],
                  [9.34, 9.57, 9.44, 9.95, 9.79, 13.44, 17.26, 20.95, 21.57, 19.79, 20.41, 0.51, 14.49, 15.56, 5.92, 6.20, 3.78, 5.58, 4.73],
                  [2708, 2681, 2754, 2650, 2728, 2693, 2668, 2699, 3117, 3409, 3420, 51420, 4557, 3973, 7435, 5354, 7112, 5710, 4885],
                  4)
                }
                else if ( prop == "LI") {
                  paginaPopup(47.166, 9.555373, 'Liechtenstein', ['nd'], ['nd'], 211)
                }
                else if ( prop == "LT") {
                  paginaPopup(55.169438, 23.881275, 'Lithuania',
                  [2.15, 2.16, 2.48, 3.08, 3.95, 4.66, 5.28, 6.20, 8.10, 9.19, 9.24, 10.32, 11.11, 12.14, 13.51, 13.04, 13.00, 13.30, 11.54],
                  [4749, 5050, 4822, 4739, 4696, 4927, 4970, 5034, 4544, 3890, 3790, 3526, 3448, 3377, 3163, 3062, 2970, 2937, 4294],
                  [2.15, 2.16, 2.48, 3.08, 3.95, 4.66, 5.28, 6.20, 8.10, 9.19, 9.24, 10.32, 11.11, 12.14, 13.51, 13.04, 13.00, 13.30, 19.88],
                  [4749, 5050, 4822, 4739, 4696, 4927, 4970, 5034, 4544, 3890, 3790, 3526, 3448, 3377, 3163, 3062, 2970, 2937, 2492],
                  134)
                }
                else if ( prop == "LU") {
                  paginaPopup(49.815273, 6.129583, 'Luxembourg',
                  [79.17, 80.05, 74.60, 84.02, 117.92, 143.97, 141.87, 175.96, 186.33, 152.17, 167.06, 163.50, 163.47, 165.91, 166.86, 162.13, 157.12, 156.15, 87.45],
                  [233, 229, 232, 225, 222, 217, 217, 214, 210, 212, 216, 220, 223, 225, 232, 239, 240, 246, 755],
                  [79.17, 80.05, 74.60, 84.02, 117.92, 143.97, 141.87, 175.96, 186.33, 152.17, 167.06, 163.50, 163.47, 165.91, 166.86, 162.13, 157.12, 156.15, 254.06],
                  [233, 229, 232, 225, 222, 217, 217, 214, 210, 212, 216, 220, 223, 225, 232, 239, 240, 246, 260],
                  175)
                }
                else if ( prop == "MK") {
                  paginaPopup(41.608635, 21.745275, 'North Macedonia',
                  [4.73, 3.83, 4.32, 5.29, 7.01, 8.55, 9.27, 9.90, 12.66, 13.17, 14.08, 14.92, 14.57, 15.82, 16.35, 14.92, 14.09, 14.34, 3.45],
                  [748, 883, 785, 737, 683, 655, 670, 679, 643, 659, 629, 608, 614, 597, 601, 648, 669, 646, 3231],
                  [4.73, 3.83, 4.32, 5.29, 7.01, 8.55, 9.27, 9.90, 12.66, 13.17, 14.08, 14.92, 14.57, 15.82, 16.35, 14.92, 14.09, 14.34, 15.02],
                  [748, 883, 785, 737, 683, 655, 670, 679, 643, 659, 629, 608, 614, 597, 601, 648, 669, 646, 743],
                  15)
                }
                else if ( prop == "MG") {
                  paginaPopup(-18.766947, 46.869107, 'Madagascar',
                  [0.41, 0.45, 0.42, 0.53, 0.55, 0.59, 0.59, 0.71, 0.85, 0.84, 0.91, 0.89, 0.92, 0.95, 0.93, 0.92, 0.74, 0.16, 1.34],
                  [8810, 8549, 8215, 8219, 8398, 8142, 8095, 8193, 8530, 9054, 8902, 9234, 9490, 9672, 10121, 10041, 12132, 12525, 9340],
                  [0.41, 0.45, 0.42, 0.53, 0.55, 0.59, 0.59, 0.71, 0.85, 0.84, 0.91, 0.89, 0.92, 0.95, 0.93, 0.92, 0.74, 0.16, 1.38],
                  [8810, 8549, 8215, 8219, 8398, 8142, 8095, 8193, 8530, 9054, 8902, 9234, 9490, 9672, 10121, 10041, 12132, 12525, 9079],
                  9)
                }
                else if ( prop == "MW") {
                  paginaPopup(-13.254308, 34.301525, 'Malawi',
                  [0.23, 0.24, 0.27, 0.37, 0.51, 0.53, 0.57, 0.62, 0.72, 0.80, 0.87, 0.95, 0.91, 0.84, 0.78, 0.72, 0.74, 0.75, 1.57],
                  [7012, 6027, 6580, 6474, 6466, 6449, 6409, 6403, 6408, 6571, 6772, 6968, 7021, 6966, 6960, 7362, 7175, 7202, 6944],
                  [0.23, 0.24, 0.27, 0.37, 0.51, 0.53, 0.57, 0.62, 0.72, 0.80, 0.87, 0.95, 0.91, 0.84, 0.78, 0.72, 0.74, 0.75, 1.61],
                  [7012, 6027, 6580, 6474, 6466, 6449, 6409, 6403, 6408, 6571, 6772, 6968, 7021, 6966, 6960, 7362, 7175, 7202, 6755],
                  121 )
                }
                else if ( prop == "MV") {
                  paginaPopup(3.202778, 73.22068, 'Maldives',
                  [5.26, 6.07, 7.54, 10.17, 4.76, 11.18, 14.86, 15.1, 18.78, 20.18, 23.06, 26.57, 27.86, 29.55, 32.19, 34.05, 36.69, 39.56, 21.26],
                  [100, 96, 93, 92, 224, 90, 91, 90, 90, 87, 86, 86, 86, 87, 90, 93, 96, 99, 172],
                  [5.26, 6.07, 7.54, 10.17, 4.76, 11.18, 14.86, 15.1, 18.78, 20.18, 23.06, 26.57, 27.86, 29.55, 32.19, 34.05, 36.69, 39.56, 29.46],
                  [100, 96, 93, 92, 224, 90, 91, 90, 90, 87, 86, 86, 86, 87, 90, 93, 96, 99, 124],
                  199)
                }
                else if ( prop == "MY") {
                  paginaPopup(4.210484, 101.975766, 'Malaysia',
                  [6.46, 6.91, 7.48, 8.03, 9.18, 10.52, 11.92, 13.53, 14.87, 14.55, 16.27, 18.62, 20.99, 22.28, 21.65, 20.56, 19.53, 18.86, 19.44],
                  [11310, 11081, 11152, 11630, 11831, 11704, 11679, 11914, 12512, 13176, 13028, 12672, 12824, 13046, 13979, 14214, 14339, 14717, 15762],
                  [6.46, 6.91, 7.48, 8.03, 9.18, 10.52, 11.92, 13.53, 14.87, 14.55, 16.27, 18.62, 20.99, 22.28, 21.65, 20.56, 19.53, 18.86, 20.03],
                  [11310, 11081, 11152, 11630, 11831, 11704, 11679, 11914, 12512, 13176, 13028, 12672, 12824, 13046, 13979, 14214, 14339, 14717, 15299],
                  107)
                }
                else if ( prop == "ML") {
                  paginaPopup(17.570692, -3.996166, 'Mali',
                  [0.28, 0.30, 0.29, 0.38, 0.50, 0.63, 0.67, 0.75, 0.84, 0.92, 0.97, 1.06, 1.03, 1.05, 1.18, 1.11, 1.07, 1.03, 1.16],
                  [10092, 10007, 10450, 9930, 8940, 8410, 8925, 8863, 9295, 9629, 9664, 9670, 10266, 11105, 10509, 11245, 11860, 12554, 13690],
                  [0.28, 0.30, 0.29, 0.38, 0.50, 0.63, 0.67, 0.75, 0.84, 0.92, 0.97, 1.06, 1.03, 1.05, 1.18, 1.11, 1.07, 1.03, 1.18],
                  [10092, 10007, 10450, 9930, 8940, 8410, 8925, 8863, 9295, 9629, 9664, 9670, 10266, 11105, 10509, 11245, 11860, 12554, 13421],
                  26)
                }

                else if ( prop == "MT") {
                  paginaPopup(35.937496, 14.375416, 'Malta',
                  [32.85, 33.54, 34.45, 37.49, 42.80, 46.78, 48.10, 51.64, 58.98, 59.08, 62.45, 66.50, 67.21, 70.23, 76.52, 77.35, 72.28, 72.09, 31.19],
                  [118, 119, 119, 121, 122, 123, 125, 127, 126, 124, 124, 122, 123, 125, 125, 129, 135, 139, 259],
                  [32.85, 33.54, 34.45, 37.49, 42.80, 46.78, 48.10, 51.64, 58.98, 59.08, 62.45, 66.50, 67.21, 70.23, 76.52, 77.35, 72.28, 72.09, 82.22],
                  [118, 119, 119, 121, 122, 123, 125, 127, 126, 124, 124, 122, 123, 125, 125, 129, 135, 139, 136],
                  198)
                }

                else if ( prop == "MA") {
                  paginaPopup(31.791702, -7.09262, 'Morocco',
                  [2.09, 2.14, 2.12, 2.44, 2.87, 3.45, 3.82, 4.15, 4.74, 5.12, 5.24, 5.45, 3.43, 5.90, 5.90, 5.94, 5.82, 5.88, 3.84],
                  [17411, 17314, 17291, 17084, 17425, 16594, 16416, 16246, 16316, 16334, 16436, 16400, 26237, 16054, 16133, 16017, 15849, 15792, 26320],
                  [2.09, 2.14, 2.12, 2.44, 2.87, 3.45, 3.82, 4.15, 4.74, 5.12, 5.24, 5.45, 3.43, 5.90, 5.90, 5.94, 5.82, 5.88, 5.33],
                  [17411, 17314, 17291, 17084, 17425, 16594, 16416, 16246, 16316, 16334, 16436, 16400, 26237, 16054, 16133, 16017, 15849, 15792, 18965],
                  129)
                }

                else if ( prop == "MR") {
                  paginaPopup(21.00789, -10.940835, 'Mauritania',
                  [0.81, 0.75, 0.78, 0.87, 1.07, 1.19, 1.53, 1.69, 2.03, 2.15, 2.30, 2.46, 2.78, 3.03, 3.02, 2.80, 2.64, 2.58, 3.47],
                  [1565, 1570, 1582, 1581, 1542, 1660, 1601, 1648, 1607, 1606, 1617, 1650, 1645, 1657, 1644, 1668, 1662, 1689, 2041],
                  [0.81, 0.75, 0.78, 0.87, 1.07, 1.19, 1.53, 1.69, 2.03, 2.15, 2.30, 2.46, 2.78, 3.03, 3.02, 2.80, 2.64, 2.58, 4.12],
                  [1565, 1570, 1582, 1581, 1542, 1660, 1601, 1648, 1607, 1606, 1617, 1650, 1645, 1657, 1644, 1668, 1662, 1689, 1717],
                  46)
                }

                else if ( prop == "MU") {
                  paginaPopup(-20.348404, 57.552152, 'Mauritius',
                  [8.01, 8.15, 7.86, 9.15, 10.85, 11.69, 12.19, 13.35, 15.09, 15.67, 16.50, 17.15, 19.84, 21.78, 22.65, 22.03, 22.28, 23.22, 18.67],
                  [526, 530, 552, 532, 529, 535, 546, 548, 555, 565, 557, 558, 550, 553, 548, 558, 549, 545, 535],
                  [8.01, 8.15, 7.86, 9.15, 10.85, 11.69, 12.19, 13.35, 15.09, 15.67, 16.50, 17.15, 19.84, 21.78, 22.65, 22.03, 22.28, 23.22, 19.02],
                  [526, 530, 552, 532, 529, 535, 546, 548, 555, 565, 557, 558, 550, 553, 548, 558, 549, 545, 525],
                  177)
                }

                else if ( prop == "MX") {
                  paginaPopup(23.634501, -102.552784, 'Mexico',
                  [9.86, 11.06, 11.69, 12.21, 13.39, 15.18, 14.65, 15.80, 14.94, 12.36, 11.56, 11.88, 13.30, 14.55, 15.80, 14.94, 13.49, 10.84, 4.76],
                  [56656, 55573, 56162, 56520, 55533, 51149, 58037, 58136, 66000, 73029, 81183, 82495, 80614, 76314, 72819, 75459, 78273, 93569, 205543],
                  [9.86, 11.06, 11.69, 12.21, 13.39, 15.18, 14.65, 15.80, 14.94, 12.36, 11.56, 11.88, 13.30, 14.55, 15.80, 14.94, 13.49, 10.84, 11.99],
                  [56656, 55573, 56162, 56520, 55533, 51149, 58037, 58136, 66000, 73029, 81183, 82495, 80614, 76314, 72819, 75459, 78273, 93569, 81698],
                  21)
                }

                else if ( prop == "FM") {
                  paginaPopup(7.425554, 150.550812, 'Micronesia',
                  [3.00, 3.09, 1.86, 3.30, 3.38, 3.56, 3.60, 3.59, 3.58, 3.94, 4.05, 4.37, 4.53, 4.70, 4.72, 4.94, 5.23, 5.35, 4.71],
                  [72, 71, 118, 70, 70, 69, 68, 68, 68, 67, 67, 66, 66, 65, 65, 70, 65, 65, 85],
                  [3.00, 3.09, 1.86, 3.30, 3.38, 3.56, 3.60, 3.59, 3.58, 3.94, 4.05, 4.37, 4.53, 4.70, 4.72, 4.94, 5.23, 5.35, 4.71],
                  [72, 71, 118, 70, 70, 69, 68, 68, 68, 67, 67, 66, 66, 65, 65, 70, 65, 65, 85],
                  184)
                }

                else if ( prop == "MD") {
                  paginaPopup(47.411631, 28.369885, 'Moldova',
                  [0.33, 0.35, 0.40, 0.49, 1.30, 0.72, 0.85, 1.00, 1.32, 1.38, 1.71, 2.20, 2.65, 3.25, 3.30, 2.89, 2.87, 3.08, 3.13],
                  [3794, 3759, 3728, 3749, 1828, 4022, 3914, 3769, 3674, 3674, 3620, 3219, 3071, 2893, 2950, 2942, 2821, 2710, 5341],
                  [0.33, 0.35, 0.40, 0.49, 1.30, 0.72, 0.85, 1.00, 1.32, 1.38, 1.71, 2.20, 2.65, 3.25, 3.30, 2.89, 2.87, 3.08, 7.02],
                  [3794, 3759, 3728, 3749, 1828, 4022, 3914, 3769, 3674, 3674, 3620, 3219, 3071, 2893, 2950, 2942, 2821, 2710, 2382],
                  146)
                }

                else if ( prop == "MC") {
                  paginaPopup(43.750298, 7.412841, 'Principality of Monaco', ['nd'], ['nd'], 224 )
                }

                else if ( prop == "MN") {
                  paginaPopup(46.862496, 103.846656, 'Mongolia',
                  [0.48, 0.48, 0.53, 0.60, 0.73, 0.85, 1.07, 1.38, 1.81, 1.85, 2.06, 2.75, 3.93, 4.81, 4.80, 4.43, 4.11, 3.81, 4.43],
                  [2121, 2169, 2195, 2266, 2340, 2416, 2423, 2404, 2376, 2347, 2398, 2367, 2382, 2358, 2346, 2352, 2366, 2397, 2697],
                  [0.48, 0.48, 0.53, 0.60, 0.73, 0.85, 1.07, 1.38, 1.81, 1.85, 2.06, 2.75, 3.93, 4.81, 4.80, 4.43, 4.11, 3.81, 4.43],
                  [2121, 2169, 2195, 2266, 2340, 2416, 2423, 2404, 2376, 2347, 2398, 2367, 2382, 2358, 2346, 2352, 2366, 2397, 2697],
                  155)
                }

                else if ( prop == "ME") {
                  paginaPopup(42.708678, 19.37439, 'Montenegro',
                  [3.15, 3.27, 3.41, 4.24, 5.47, 6.53, 7.90, 9.66, 12.56, 13.44, 14.13, 15.09, 14.80, 14.74, 15.51, 15.60, 15.32, 15.99, 4.45],
                  [327, 325, 320, 320, 316, 313, 306, 297, 289, 282, 276, 271, 267, 281, 267, 263, 262, 262, 986],
                  [3.15, 3.27, 3.41, 4.24, 5.47, 6.53, 7.90, 9.66, 12.56, 13.44, 14.13, 15.09, 14.80, 14.74, 15.51, 15.60, 15.32, 15.99, 14.20],
                  [327, 325, 320, 320, 316, 313, 306, 297, 289, 282, 276, 271, 267, 281, 267, 263, 262, 262, 309],
                  112)
                }

                else if ( prop == "MZ") {
                  paginaPopup(-18.665695, 35.529562, 'Mozambique',
                  [0.34, 0.37, 0.34, 0.40, 0.46, 0.52, 0.54, 0.57, 0.62, 0.69, 0.68, 0.73, 0.81, 0.91, 0.97, 0.89, 0.74, 0.66, 0.77],
                  [13191, 12225, 12340, 12235, 12424, 12750, 13432, 14161, 14509, 14673, 14932, 15049, 15281, 15695, 15907, 16460, 16667, 16785, 16528],
                  [0.34, 0.37, 0.34, 0.40, 0.46, 0.52, 0.54, 0.57, 0.62, 0.69, 0.68, 0.73, 0.81, 0.91, 0.97, 0.89, 0.74, 0.66, 0.78],
                  [13191, 12225, 12340, 12235, 12424, 12750, 13432, 14161, 14509, 14673, 14932, 15049, 15281, 15695, 15907, 16460, 16667, 16785, 16365],
                  39)
                }

                else if ( prop == "NA") {
                  paginaPopup(-22.95764, 18.49041, 'Namibia',
                  [1.64, 1.85, 1.74, 2.05, 2.69, 3.45, 4.18, 4.59, 4.84, 4.87, 5.65, 6.37, 7.82, 8.23, 8.59, 8.14, 7.46, 7.24, 4.99],
                  [2016, 1883, 1937, 1907, 1860, 1802, 1730, 1672, 1654, 1654, 1538, 1589, 1452, 1485, 1441, 1435, 1432, 1449, 1952],
                  [1.64, 1.85, 1.74, 2.05, 2.69, 3.45, 4.18, 4.59, 4.84, 4.87, 5.65, 6.37, 7.82, 8.23, 8.59, 8.14, 7.46, 7.24, 5.54],
                  [2016, 1883, 1937, 1907, 1860, 1802, 1730, 1672, 1654, 1654, 1538, 1589, 1452, 1485, 1441, 1435, 1432, 1449, 1756],
                  85)
                }

                else if ( prop == "NR") {
                  paginaPopup(-0.522778, 166.931503, 'Nauru', ['nd'], ['nd'],221)
                }

                else if ( prop == "NP") {
                  paginaPopup(28.394857, 84.124008, 'Nepal',
                  [0.35, 0.36, 0.28, 0.38, 0.38, 0.46, 0.53, 0.60, 0.70, 0.78, 0.87, 0.96, 1.08, 1.13, 1.14, 0.75, 1.14, 1.26, 1.72],
                  [14422, 14443, 18958, 15481, 16776, 15634, 14962, 14598, 14842, 15042, 15238, 15635, 15817, 16187, 16401, 25462, 16746, 16831, 17845],
                  [0.35, 0.36, 0.28, 0.38, 0.38, 0.46, 0.53, 0.60, 0.70, 0.78, 0.87, 0.96, 1.08, 1.13, 1.14, 0.75, 1.14, 1.26, 2.03],
                  [14422, 14443, 18958, 15481, 16776, 15634, 14962, 14598, 14842, 15042, 15238, 15635, 15817, 16187, 16401, 25462, 16746, 16831, 15087],
                  148)
                }

                else if ( prop == "NI") {
                  paginaPopup(12.865416, -85.207229, 'Nicaragua',
                  [1.73, 1.75, 1.75, 1.87, 2.02, 2.19, 2.38, 2.51, 2.87, 2.98, 3.22, 3.56, 3.84, 4.03, 4.14, 4.71, 5.07, 5.35, 4.56],
                  [2566, 2591, 2600, 2620, 2599, 2612, 2527, 2608, 2494, 2419, 2398, 2368, 2392, 2432, 2493, 2296, 2259, 2269, 2520],
                  [1.73, 1.75, 1.75, 1.87, 2.02, 2.19, 2.38, 2.51, 2.87, 2.98, 3.22, 3.56, 3.84, 4.03, 4.14, 4.71, 5.07, 5.35, 4.88],
                  [2566, 2591, 2600, 2620, 2599, 2612, 2527, 2608, 2494, 2419, 2398, 2368, 2392, 2432, 2493, 2296, 2259, 2269, 2355],
                  127)
                }

                else if ( prop == "NE") {
                  paginaPopup(17.607789, 8.081666, 'Niger',
                  [0.21, 0.21, 0.21, 0.26, 0.31, 0.36, 0.39, 0.42, 0.52, 0.56, 0.62, 0.65, 0.70, 0.73, 0.76, 0.68, 0.67, 0.67, 1.03],
                  [8351, 8429, 8345, 8158, 8055, 8428, 8558, 8532, 8384, 8358, 8324, 8585, 8765, 9121, 9379, 10430, 10397, 10464, 12108],
                  [0.21, 0.21, 0.21, 0.26, 0.31, 0.36, 0.39, 0.42, 0.52, 0.56, 0.62, 0.65, 0.70, 0.73, 0.76, 0.68, 0.67, 0.67, 1.04],
                  [8351, 8429, 8345, 8158, 8055, 8428, 8558, 8532, 8384, 8358, 8324, 8585, 8765, 9121, 9379, 10430, 10397, 10464, 12012],
                  56)
                }

                else if ( prop == "NG") {
                  paginaPopup(9.08199, 8.675277, 'Nigeria',
                  [0.78, 0.88, 1.10, 1.30, 1.54, 2.01, 2.62, 3.17, 4.023, 4.24, 4.47, 4.55, 5.09, 5.60, 5.33, 6.25, 4.96, 4.40, 5.00],
                  [67306, 68205, 66639, 65508, 69350, 64684, 66759, 67564, 66610, 67530, 68957, 71255, 73440, 75876, 89894, 75912, 84208, 82758, 78694],
                  [0.78, 0.88, 1.10, 1.30, 1.54, 2.01, 2.62, 3.17, 4.023, 4.24, 4.47, 4.55, 5.09, 5.60, 5.33, 6.25, 4.96, 4.40, 5.08],
                  [67306, 68205, 66639, 65508, 69350, 64684, 66759, 67564, 66610, 67530, 68957, 71255, 73440, 75876, 89894, 75912, 84208, 82758, 77416],
                  82)
                }

                else if ( prop == "NO") {
                  paginaPopup(60.472024, 8.468946, 'Norway',
                  [59.41, 63.63, 67.39, 78.15, 95.48, 115.72, 129.49, 145.64, 161.11, 160.60, 161.94, 157.99, 190.19, 197.66, 205.25, 189.51, 166.93, 155.23, 115.71],
                  [2515, 2469, 2445, 2379, 2368, 2319, 2292, 2308, 2356, 2405, 2433, 2579, 2382, 2440, 2381, 2319, 2329, 2356, 2869],
                  [59.41, 63.63, 67.39, 78.15, 95.48, 115.72, 129.49, 145.64, 161.11, 160.60, 161.94, 157.99, 190.19, 197.66, 205.25, 189.51, 166.93, 155.23, 136.45],
                  [2515, 2469, 2445, 2379, 2368, 2319, 2292, 2308, 2356, 2405, 2433, 2579, 2382, 2440, 2381, 2319, 2329, 2356, 2433],
                  145)
                }

                else if ( prop == "NZ") {
                  paginaPopup(-40.900557, 174.885971, 'New Zeland',
                  [29.78, 29.32, 29.98, 35.84, 46.68, 56.36, 58.89, 61.39, 61.91, 65.14, 64.58, 60.22, 82.89, 93.33, 98.06, 96.69, 94.77, 93.13, 99.53],
                  [1660, 1663, 1698, 1735, 1713, 1698, 1707, 1763, 1795, 1785, 1820, 2137, 1777, 1728, 1743, 1756, 1776, 1802, 1843],
                  [29.78, 29.32, 29.98, 35.84, 46.68, 56.36, 58.89, 61.39, 61.91, 65.14, 64.58, 60.22, 82.89, 93.33, 98.06, 96.69, 94.77, 93.13, 100.90],
                  [1660, 1663, 1698, 1735, 1713, 1698, 1707, 1763, 1795, 1785, 1820, 2137, 1777, 1728, 1743, 1756, 1776, 1802, 1818],
                  41)
                }

                else if ( prop == "OM") {
                  paginaPopup(21.512583, 55.923255, 'Oman',
                  [9.01, 10.26, 10.13, 11.08, 13.62, 16.60, 18.21, 22.23, 27.15, 28.41, 28.44, 24.51, 26.99, 29.90, 30.38, 29.68, 27.12, 25.18, 18.01],
                  [1620, 1612, 1668, 1616, 1532, 1462, 1484, 1576, 1607, 1634, 1768, 2043, 2284, 2328, 2312, 2335, 2419, 2436, 4183],
                  [9.01, 10.26, 10.13, 11.08, 13.62, 16.60, 18.21, 22.23, 27.15, 28.41, 28.44, 24.51, 26.99, 29.90, 30.38, 29.68, 27.12, 25.18, 28.04],
                  [1620, 1612, 1668, 1616, 1532, 1462, 1484, 1576, 1607, 1634, 1768, 2043, 2284, 2328, 2312, 2335, 2419, 2436, 2686],
                  74)
                }

                else if ( prop == "NL") {
                  paginaPopup(52.132633, 5.291266, 'Netherlands',
                  [67.15, 63.79, 63.11, 72.47, 90.01, 102.84, 113.38, 122.07, 127.66, 129.56, 128.15, 126.02, 118.10, 116.52, 110.82, 105.11, 96.00, 97.02, 42.78],
                  [6218, 6269, 6291, 6305, 6136, 6072, 6023, 5997, 6174, 6231, 6359, 6567, 6833, 6949, 7198, 7305, 7571, 7531, 19063],
                  [67.15, 63.79, 63.11, 72.47, 90.01, 102.84, 113.38, 122.07, 127.66, 129.56, 128.15, 126.02, 118.10, 116.52, 110.82, 105.11, 96.00, 97.02, 105.05],
                  [6218, 6269, 6291, 6305, 6136, 6072, 6023, 5997, 6174, 6231, 6359, 6567, 6833, 6949, 7198, 7305, 7571, 7531, 7764],
                  131)
                }

                else if ( prop == "PK") {
                  paginaPopup(30.375321, 69.345116, 'Pakistan',
                  [0.68, 0.68, 0.71, 0.77, 0.89, 0.58, 1.15, 1.27, 1.36, 1.38, 1.41, 1.57, 1.72, 1.88, 1.93, 2.04, 2.24, 2.45, 2.52],
                  [91814, 93275, 94882, 97137, 98802, 174738, 101940, 104432, 110919, 116114, 118948, 115621, 118792, 118828, 121094, 120512, 117333, 115539, 95393],
                  [0.68, 0.68, 0.71, 0.77, 0.89, 0.58, 1.15, 1.27, 1.36, 1.38, 1.41, 1.57, 1.72, 1.88, 1.93, 2.04, 2.24, 2.45, 2.81],
                  [91814, 93275, 94882, 97137, 98802, 174738, 101940, 104432, 110919, 116114, 118948, 115621, 118792, 118828, 121094, 120512, 117333, 115539, 85346],
                  6)
                }

                else if ( prop == "PW") {
                  paginaPopup(7.51498, 134.58252, 'Palau', ['nd'], ['nd'],188 )
                }

                else if ( prop == "PS") {
                  paginaPopup(31.952162, 35.233154, 'Palestine',
                  [1.33, 0.96, 0.66, 0.92, 0.89, 1.34, 0.80, 1.40, 0.86, 0.97, 4.76, 5.34, 4.79, 10.04, 5.41, 8.76, 10.03, 11.36, 5.21],
                  [3245, 4205, 5358, 4298, 4790, 3531, 6014, 3838, 7564, 7276, 1829, 1919, 2313, 1225, 2327, 1438, 1337, 1284, 2813],
                  [1.33, 0.96, 0.66, 0.92, 0.89, 1.34, 0.80, 1.40, 0.86, 0.97, 4.76, 5.34, 4.79, 10.04, 5.41, 8.76, 10.03, 11.36, 11.16],
                  [3245, 4205, 5358, 4298, 4790, 3531, 6014, 3838, 7564, 7276, 1829, 1919, 2313, 1225, 2327, 1438, 1337, 1284, 1313],
                  169)
                }

                else if ( prop == "PA") {
                  paginaPopup(8.537981, -80.782127, 'Panama',
                  [8.35, 8.41, 8.21, 8.31, 10.23, 10.26, 9.61, 11.91, 12.35, 12.47, 13.67, 16.59, 19.39, 23.92, 25.46, 31.65, 28.74, 30.34, 8.39],
                  [1337, 1348, 1434, 1492, 1328, 1443, 1706, 1615, 1839, 1979, 1960, 1903, 1897, 1735, 1784, 1555, 1835, 5776],
                  [8.35, 8.41, 8.21, 8.31, 10.23, 10.26, 9.61, 11.91, 12.35, 12.47, 13.67, 16.59, 19.39, 23.92, 25.46, 31.65, 28.74, 30.34, 26.13],
                  [1337, 1348, 1434, 1492, 1328, 1443, 1706, 1615, 1839, 1979, 1960, 1903, 1897, 1735, 1784, 1555, 1835, 1843],
                  75)
                }

                else if ( prop == "PG") {
                  paginaPopup(-6.314993, 143.95555, 'Papua Nuova Guinea',
                  [0.46, 0.39, 0.36, 0.42, 0.45, 0.53, 0.87, 0.96, 1.16, 1.17, 1.41, 1.74, 1.95, 1.98, 2.13, 1.97, 1.85, 1.96, 3.39],
                  [6683, 6978, 7226, 7445, 7709, 8010, 8323, 8714, 8786, 9006, 9185, 9411, 9948, 9765, 9911, 10025, 10219, 10362, 6341],
                  [0.46, 0.39, 0.36, 0.42, 0.45, 0.53, 0.87, 0.96, 1.16, 1.17, 1.41, 1.74, 1.95, 1.98, 2.13, 1.97, 1.85, 1.96, 3.39],
                  [6683, 6978, 7226, 7445, 7709, 8010, 8323, 8714, 8786, 9006, 9185, 9411, 9948, 9765, 9911, 10025, 10219, 10362, 6332],
                  52)
                }

                else if ( prop == "PY") {
                  paginaPopup(-23.442503, -58.443832, 'Paraguay',
                  [3.65, 3.30, 2.14, 2.57, 2.85, 3.38, 3.77, 4.92, 6.02, 6.56, 8.21, 10.51, 10.38, 11.60, 11.74, 8.86, 8.78, 9.45, 5.27],
                  [2039, 2108, 2677, 2322, 2556, 2345, 2561, 2544, 2791, 3099, 3015, 2918, 2917, 3028, 3121, 3716, 3738, 3757, 6101],
                  [3.65, 3.30, 2.14, 2.57, 2.85, 3.38, 3.77, 4.92, 6.02, 6.56, 8.21, 10.51, 10.38, 11.60, 11.74, 8.86, 8.78, 9.45, 8.28],
                  [2039, 2108, 2677, 2322, 2556, 2345, 2561, 2544, 2791, 3099, 3015, 2918, 2917, 3028, 3121, 3716, 3738, 3757, 3881],
                  79)
                }

                else if ( prop == "PE") {
                  paginaPopup(-9.189967, -75.015152, 'Peru',
                  [5.24, 6.18, 6.72, 6.21, 7.47, 6.12, 9.46, 9.48, 12.20, 12.49, 15.55, 17.96, 16.89, 15.85, 18.08, 16.62, 13.02, 14.26, 1.72],
                  [8968, 7638, 7394, 8579, 8108, 11286, 8506, 9782, 8965, 8801, 8634, 8703, 10378, 11552, 10118, 10391, 13408, 13443, 106571],
                  [5.24, 6.18, 6.72, 6.21, 7.47, 6.12, 9.46, 9.48, 12.20, 12.49, 15.55, 17.96, 16.89, 15.85, 18.08, 16.62, 13.02, 14.26, 13.61],
                  [8968, 7638, 7394, 8579, 8108, 11286, 8506, 9782, 8965, 8801, 8634, 8703, 10378, 11552, 10118, 10391, 13408, 13443, 13505],
                  1)
                }

                else if ( prop == "PT") {
                  paginaPopup(39.399872, -8.224454, 'Portugal',
                  [22.50, 21.24, 21.10, 26.45, 32.90, 35.53, 38.06, 48.89, 52.31, 49.54, 47.90, 54.25, 49.78, 48.67, 43.37, 42.23, 43.30, 44.25, 17.77],
                  [4769, 5171, 5741, 5630, 5198, 5029, 4970, 4461, 4554, 4477, 4527, 4108, 3955, 4227, 4818, 4297, 4335, 4510, 11715],
                  [22.50, 21.24, 21.10, 26.45, 32.90, 35.53, 38.06, 48.89, 52.31, 49.54, 47.90, 54.25, 49.78, 48.67, 43.37, 42.23, 43.30, 44.25, 42.63],
                  [4769, 5171, 5741, 5630, 5198, 5029, 4970, 4461, 4554, 4477, 4527, 4108, 3955, 4227, 4818, 4297, 4335, 4510, 4885],
                  44)
                }

                else if ( prop == "PL") {
                  paginaPopup(51.919438, 19.145136, 'Poland',
                  [6.09, 6.94, 7.14, 8.01, 10.29, 12.17, 12.53, 15.89, 19.30, 16.47, 18.31, 20.23, 19.31, 21.25, 23.19, 21.92, 19.60, 22.10, 10.87],
                  [25763, 25043, 25388, 24811, 24966, 25345, 25193, 24751, 25363, 24297, 23828, 23784, 23580, 22453, 21400, 19827, 21910, 21676, 49601],
                  [6.09, 6.94, 7.14, 8.01, 10.29, 12.17, 12.53, 15.89, 19.30, 16.47, 18.31, 20.23, 19.31, 21.25, 23.19, 21.92, 19.60, 22.10, 25.62],
                  [25763, 25043, 25388, 24811, 24966, 25345, 25193, 24751, 25363, 24297, 23828, 23784, 23580, 22453, 21400, 19827, 21910, 21676, 21047],
                  84)
                }

                else if ( prop == "QA") {
                  paginaPopup(25.354826, 51.183884, 'Qatar',
                  [59.16, 76.50, 55.34, 61.86, 98.18, 118.51, 114.04, 162.94, 240.42, 204.59, 283.24, 400.72, 443.91, 411.01, 400.99, 350.44, 333.52, 180.77, 89.21],
                  [273, 207, 312, 335, 283, 330, 474, 440, 435, 435, 402, 381, 383, 440, 468, 420, 414, 840, 1493],
                  [59.16, 76.50, 55.34, 61.86, 98.18, 118.51, 114.04, 162.94, 240.42, 204.59, 283.24, 400.72, 443.91, 411.01, 400.99, 350.44, 333.52, 180.77, 106.72],
                  [273, 207, 312, 335, 283, 330, 474, 440, 435, 435, 402, 381, 383, 440, 468, 420, 414, 840, 1248],
                  165)
                  chart.options.scales.yAxes[0].ticks.max = 450;
                  chart.options.scales.yAxes[0].ticks.stepSize = 45;
                  chart.update();
                }

                else if ( prop == "GB") {
                  paginaPopup(55.378051, -3.435973, 'United Kingdom',
                  [76.54, 72.34, 80.62, 90.96, 105.21, 110.64, 116.80, 134.23, 122.41, 103.38, 109.11, 113.87, 117.19, 112.55, 119.41, 108.62, 115.22, 114.30, 26.57],
                  [19530, 20330, 19883, 20304, 20640, 20610, 20853, 20728, 21390, 21081, 20457, 21057, 20784, 22264, 23128, 24266, 21003, 21001, 93673],
                  [76.54, 72.34, 80.62, 90.96, 105.21, 110.64, 116.80, 134.23, 122.41, 103.38, 109.11, 113.87, 117.19, 112.55, 119.41, 108.62, 115.22, 114.30, 117.80],
                  [19530, 20330, 19883, 20304, 20640, 20610, 20853, 20728, 21390, 21081, 20457, 21057, 20784, 22264, 23128, 24266, 21003, 21001, 21125],
                  77)
                }

                else if ( prop == "CZ") {
                  paginaPopup(49.817492, 15.472962, 'Czech Republic',
                  [7.92, 8.89, 10.90, 12.42, 15.49, 19.43, 24.02, 28.10, 34.99, 31.55, 31.42, 34.73, 32.23, 34.04, 33.10, 29.25, 32.21, 36.00, 12.77],
                  [7070, 6910, 6838, 7295, 6991, 6376, 5893, 6131, 6121, 5946, 6009, 5973, 5856, 5598, 5714, 5812, 5511, 5458, 17369],
                  [7.92, 8.89, 10.90, 12.42, 15.49, 19.43, 24.02, 28.10, 34.99, 31.55, 31.42, 34.73, 32.23, 34.04, 33.10, 29.25, 32.21, 36.00, 40.28],
                  [7070, 6910, 6838, 7295, 6991, 6376, 5893, 6131, 6121, 5946, 6009, 5973, 5856, 5598, 5714, 5812, 5511, 5458, 5507],
                  67)
                }

                else if ( prop == "CF") {
                  paginaPopup(6.611111, 20.939444, 'Central African Republic',
                  [0.16, 0.15, 0.15, 0.18, 0.20, 0.21, 0.21, 0.23, 0.28, 0.28, 0.27, 0.32, 0.32, 0.13, 0.14, 0.22, 0.26, 0.24, 0.34],
                  [5065, 5435, 5806, 5574, 5636, 5709, 6240, 6542, 6258, 6468, 6661, 6396, 6396, 10762, 11486, 6911, 6671, 8055, 6106],
                  [0.16, 0.15, 0.15, 0.18, 0.20, 0.21, 0.21, 0.23, 0.28, 0.28, 0.27, 0.32, 0.32, 0.13, 0.14, 0.22, 0.26, 0.24, 0.35],
                  [5065, 5435, 5806, 5574, 5636, 5709, 6240, 6542, 6258, 6468, 6661, 6396, 6396, 10762, 11486, 6911, 6671, 8055, 6043],
                  132)
                }

                else if ( prop == "DO") {
                  paginaPopup(18.735693, -70.162651, 'Dominican Republic',
                  [7.06, 6.77, 6.87, 4.86, 4.96, 7.94, 9.04, 11.26, 11.61, 12.11, 11.60, 13.76, 12.14, 8.55, 7.43, 7.50, 7.62, 8.22, 7.27],
                  [3124, 3381, 3616, 4038, 4154, 4129, 3828, 3560, 3774, 3625, 4223, 3812, 4592, 6728, 8069, 8328, 8475, 8387, 9868],
                  [7.06, 6.77, 6.87, 4.86, 4.96, 7.94, 9.04, 11.26, 11.61, 12.11, 11.60, 13.76, 12.14, 8.55, 7.43, 7.50, 7.62, 8.22, 9.62],
                  [3124, 3381, 3616, 4038, 4154, 4129, 3828, 3560, 3774, 3625, 4223, 3812, 4592, 6728, 8069, 8328, 8475, 8387, 7459],
                  32)
                }

                else if ( prop == "RO") {
                  paginaPopup(45.943161, 24.96676, 'Romania',
                  [2.32, 2.57, 2.90, 3.87, 5.17, 6.97, 8.57, 12.74, 14.91, 12.67, 12.22, 15.53, 14.47, 17.17, 18.01, 16.40, 17.31, 18.96, 8.14],
                  [14412, 14270, 14509, 14123, 13462, 13041, 13084, 12593, 13133, 12501, 12379, 10748, 10768, 10122, 10089, 9871, 9907, 10147, 27722],
                  [2.32, 2.57, 2.90, 3.87, 5.17, 6.97, 8.57, 12.74, 14.91, 12.67, 12.22, 15.53, 14.47, 17.17, 18.01, 16.40, 17.31, 18.96, 23.15],
                  [14412, 14270, 14509, 14123, 13462, 13041, 13084, 12593, 13133, 12501, 12379, 10748, 10768, 10122, 10089, 9871, 9907, 10147, 9753],
                  59)
                }

                else if ( prop == "RW") {
                  paginaPopup(-1.940278, 29.873888, 'Rwanda',
                  [0.16, 0.17, 0.20, 0.24, 0.30, 0.38, 0.47, 0.58, 0.75, 0.85, 0.91, 1.02, 1.10, 1.17, 1.21, 1.24, 1.25, 1.36, 1.62],
                  [9555, 9031, 7545, 6917, 6392, 6241, 6164, 6051, 5911, 5719, 5799, 5860, 6058, 5904, 6010, 6059, 6175, 6129, 5813],
                  [0.16, 0.17, 0.20, 0.24, 0.30, 0.38, 0.47, 0.58, 0.75, 0.85, 0.91, 1.02, 1.10, 1.17, 1.21, 1.24, 1.25, 1.36, 1.64],
                  [9555, 9031, 7545, 6917, 6392, 6241, 6164, 6051, 5911, 5719, 5799, 5860, 6058, 5904, 6010, 6059, 6175, 6129, 5727],
                  114)
                }

                else if ( prop == "RU") {
                  paginaPopup(61.52401, 105.318756, 'Russia',
                  [0.74, 0.84, 0.92, 1.16, 1.64, 2.20, 3.18, 5.00, 6.18, 5.72, 6.40, 9.37, 10.38, 11.28, 9.88, 6.88, 7.34, 9.19, 6.81],
                  [318716, 331634, 339296, 335173, 327123, 315914, 282785, 236412, 244463, 194576, 216867, 199358, 193774, 185353, 186779, 177590, 156495, 153835, 197349],
                  [0.74, 0.84, 0.92, 1.16, 1.64, 2.20, 3.18, 5.00, 6.18, 5.72, 6.40, 9.37, 10.38, 11.28, 9.88, 6.88, 7.34, 9.19, 9.58],
                  [318716, 331634, 339296, 335173, 327123, 315914, 282785, 236412, 244463, 194576, 216867, 199358, 193774, 185353, 186779, 177590, 156495, 153835, 140330],
                  92)
                }

                else if ( prop == "KN") {
                  paginaPopup(17.357822, -62.782998, 'Saint Kitts and Nevis',
                  [23.85, 27.9, 18.27, 16.26, 16.89, 14.94, 15.19, 13.90, 15.97, 14.92, 15.61, 15.90, 18.52, 17.98, 17.10, 16.27, 21.33, 22.51, 26.98],
                  [16, 15, 24, 26, 27, 33, 38, 44, 42, 44, 41, 43, 36, 39, 45, 49, 29, 36, 31],
                  [23.85, 27.9, 18.27, 16.26, 16.89, 14.94, 15.19, 13.90, 15.97, 14.92, 15.61, 15.90, 18.52, 17.98, 17.10, 16.27, 21.33, 22.51, 26.98],
                  [16, 15, 24, 26, 27, 33, 38, 44, 42, 44, 41, 43, 36, 39, 45, 49, 29, 36, 31],
                  201)
                }

                else if ( prop == "LC") {
                  paginaPopup(13.909444, -60.978893, 'Saint Lucia',
                  [7.34, 8.55, 6.55, 8.54, 9.84, 9.28, 14.49, 12.03, 12.50, 10.39, 13.15, 11.21, 13.10, 11.79, 12.86, 14.60, 14.53, 14.84, 13.45],
                  [97, 79, 104, 88, 83, 94, 72, 98, 34, 113, 98, 120, 103, 119, 114, 107, 109, 110, 115],
                  [7.34, 8.55, 6.55, 8.54, 9.84, 9.28, 14.49, 12.03, 12.50, 10.39, 13.15, 11.21, 13.10, 11.79, 12.86, 14.60, 14.53, 14.84, 14.06],
                  [97, 79, 104, 88, 83, 94, 72, 98, 34, 113, 98, 120, 103, 119, 114, 107, 109, 110, 110],
                  194)
                }

                else if ( prop == "VC") {
                  paginaPopup(12.984305, -61.287228,'Saint Vincent and...',
                  [7.82, 7.23, 7.23, 10.67, 6.23, 6.58, 9.56, 8.33, 10.88, 10.75, 11.66, 13.06, 11.03, 11.09, 9.14, 9.16, 9.02, 9.31, 10.48],
                  [46, 54, 58, 41, 76, 76, 58, 71, 58, 57, 53, 47, 57, 59, 72, 75, 77, 77, 70],
                  [7.82, 7.23, 7.23, 10.67, 6.23, 6.58, 9.56, 8.33, 10.88, 10.75, 11.66, 13.06, 11.03, 11.09, 9.14, 9.16, 9.02, 9.31, 10.48],
                  [46, 54, 58, 41, 76, 76, 58, 71, 58, 57, 53, 47, 57, 59, 72, 75, 77, 77, 70],
                  193)
                }

                else if ( prop == "WS") {
                  paginaPopup(-13.759029, -172.104629, 'Samoa',
                  [3.13, 3.22, 11.66, 3.99, 4.89, 4.94, 7.46, 6.58, 7.79, 2.29, 7.80, 8.86, 8.28, 9.64, 9.64, 9.63, 9.42, 10.08, 6.56],
                  [78, 77, 77, 77, 78, 85, 76, 76, 75, 223, 75, 76, 88, 76, 76, 76, 76, 76, 112],
                  [3.13, 3.22, 11.66, 3.99, 4.89, 4.94, 7.46, 6.58, 7.79, 2.29, 7.80, 8.86, 8.28, 9.64, 9.64, 9.63, 9.42, 10.08, 6.56],
                  [78, 77, 77, 77, 78, 85, 76, 76, 75, 223, 75, 76, 88, 76, 76, 76, 76, 76, 112],
                  174)
                }

                else if ( prop == "SM") {
                  paginaPopup(43.94236, 12.457777, 'San Marino', ['nd'], ['nd'],218)
                }

                else if ( prop == "ST") {
                  paginaPopup(0.18636, 6.613081, 'São Tomé and Príncipe',
                  [1.04, 0.97, 1.10, 1.28, 1.39, 1.69, 1.75, 1.79, 1.84, 2.47, 2.60, 3.03, 3.15, 11.79, 4.22, 3.84, 4.30, 4.73, 4.94],
                  [66, 66, 65, 67, 67, 66, 68, 84, 91, 71, 71, 72, 75, 77, 77, 76, 76, 76, 87],
                  [1.04, 0.97, 1.10, 1.28, 1.39, 1.69, 1.75, 1.79, 1.84, 2.47, 2.60, 3.03, 3.15, 11.79, 4.22, 3.84, 4.30, 4.73, 6.14],
                  [66, 66, 65, 67, 67, 66, 68, 84, 91, 71, 71, 72, 75, 77, 77, 76, 76, 76, 70],
                  179)
                }

                else if ( prop == "SN") {
                  paginaPopup(14.497401, -14.452362, 'Senegal',
                  [0.78, 0.79, 0.71, 1.10, 1.23, 1.34, 1.38, 1.72, 2.07, 2.55, 2.53, 2.74, 2.70, 2.84, 2.89, 2.54, 2.71, 2.94, 3.60],
                  [5422, 5570, 6856, 5685, 5919, 5923, 6175, 5971, 5903, 5807, 5824, 5937, 6003, 6075, 6229, 6378, 6391, 6517, 6289],
                  [0.78, 0.79, 0.71, 1.10, 1.23, 1.34, 1.38, 1.72, 2.07, 2.55, 2.53, 2.74, 2.70, 2.84, 2.89, 2.54, 2.71, 2.94, 3.85],
                  [5422, 5570, 6856, 5685, 5919, 5923, 6175, 5971, 5903, 5807, 5824, 5937, 6003, 6075, 6229, 6378, 6391, 6517, 5887],
                  116)
                }

                else if ( prop == "RS") {
                  paginaPopup(44.016521, 21.005859, 'Serbia',
                  [1.81, 3.23, 4.74, 6.12, 7.24, 7.72, 8.87, 11.69, 15.01, 10.99, 11.24, 13.48, 12.00, 13.88, 13.93, 11.80, 8.91, 9.82, 8.60],
                  [4122, 4306, 3838, 3895, 3852, 3809, 3869, 3869, 3692, 3739, 3387, 3325, 3285, 3172, 3075, 3056, 4150, 4090, 7088],
                  [1.81, 3.23, 4.74, 6.12, 7.24, 7.72, 8.87, 11.69, 15.01, 10.99, 11.24, 13.48, 12.00, 13.88, 13.93, 11.80, 8.91, 9.82, 15.53],
                  [4122, 4306, 3838, 3895, 3852, 3809, 3869, 3869, 3692, 3739, 3387, 3325, 3285, 3172, 3075, 3056, 4150, 4090, 3925],
                  111)
                }

                else if ( prop == "SC") {
                  paginaPopup(-4.679574, 55.491977, 'Seychelles',
                  [10.34, 22.96, 16.30, 12.52, 21.23, 26.28, 20.85, 23.86, 23.72, 18.36, 22.63, 15.40, 33.27, 25.72, 26.57, 24.11, 22.02, 23.18, 18.45],
                  [54, 25, 39, 53, 38, 34, 47, 42, 39, 42, 39, 63, 29, 47, 46, 52, 59, 59, 55],
                  [10.34, 22.96, 16.30, 12.52, 21.23, 26.28, 20.85, 23.86, 23.72, 18.36, 22.63, 15.40, 33.27, 25.72, 26.57, 24.11, 22.02, 23.18, 18.45],
                  [54, 25, 39, 53, 38, 34, 47, 42, 39, 42, 39, 63, 29, 47, 46, 52, 59, 59, 55],
                  189)
                }

                else if ( prop == "SL") {
                  paginaPopup(8.460555,-11.779889, 'Sierra Leone',
                  [0.12, 0.27, 0.31, 0.34, 0.34, 0.38, 0.43, 0.47, 0.57, 0.58, 0.62, 0.70, 0.89, 1.13, 1.15, 0.97, 0.85, 0.82, 0.81],
                  [4148, 3251, 3265, 3345, 3470, 3492, 3530, 3748, 3548, 3875, 3761, 3808, 3880, 3949, 3973, 3957, 3912, 4167, 4351],
                  [0.12, 0.27, 0.31, 0.34, 0.34, 0.38, 0.43, 0.47, 0.57, 0.58, 0.62, 0.70, 0.89, 1.13, 1.15, 0.97, 0.85, 0.82, 0.82],
                  [4148, 3251, 3265, 3345, 3470, 3492, 3530, 3748, 3548, 3875, 3761, 3808, 3880, 3949, 3973, 3957, 3912, 4167, 4275],
                  25)
                }

                else if ( prop == "SG") {
                  paginaPopup(1.352083, 103.8198366, 'Singapore',
                  [100.12, 99.47, 99.93, 105.59, 145.87, 144.05, 169.03, 206.71, 218.52, 231.86, 286.39, 324.25, 343.83, 385.00, 404.68, 418.96, 289.44, 303.10, 323.55],
                  [845, 792, 827, 862, 822, 846, 832, 815, 800, 762, 762, 784, 781, 727, 708, 669, 1000, 1016, 984],
                  [100.12, 99.47, 99.93, 105.59, 145.87, 144.05, 169.03, 206.71, 218.52, 231.86, 286.39, 324.25, 343.83, 385.00, 404.68, 418.96, 289.44, 303.10, 333.38],
                  [845, 792, 827, 862, 822, 846, 832, 815, 800, 762, 762, 784, 781, 727, 708, 669, 1000, 1016, 955],
                  228)
                }

                else if ( prop == "SY") {
                  paginaPopup(34.802075, 38.996815, 'Syria',
                  [3.72, 4.14, 4.05, 4.56, 9.06, 8.82, 9.28, 10.85, 11.10, 15.47, 17.75, 3.80, 1.02, 0.45, 0.27, 0.29, 0.19, 0.30, 3.83],
                  [4695, 4606, 4809, 4316, 2491, 2931, 3202, 3302, 3689, 3206, 3102, 16096, 65407, 55005, 78709, 59923, 59886, 45412, 11657],
                  [3.72, 4.14, 4.05, 4.56, 9.06, 8.82, 9.28, 10.85, 11.10, 15.47, 17.75, 3.80, 1.02, 0.45, 0.27, 0.29, 0.19, 0.30, 4.08],
                  [4695, 4606, 4809, 4316, 2491, 2931, 3202, 3302, 3689, 3206, 3102, 16096, 65407, 55005, 78709, 59923, 59886, 45412, 10953],
                  71)
                }

                else if ( prop == "SK") {
                  paginaPopup(48.669026, 19.699024, 'Slovakia',
                  [8.48, 9.18, 10.55, 13.78, 17.00, 18.21, 20.98, 26.47, 28.78, 27.37, 27.64, 29.73, 24.97, 28.55, 29.02, 27.43, 29.31, 31.79, 19.73],
                  [3114, 3039, 3022, 3083, 3062, 3132, 3062, 2968, 3174, 2957, 2947, 3005, 3405, 3139, 3166, 2912, 2790, 2737, 4823],
                  [8.48, 9.18, 10.55, 13.78, 17.00, 18.21, 20.98, 26.47, 28.78, 27.37, 27.64, 29.73, 24.97, 28.55, 29.02, 27.43, 29.31, 31.79, 34.51],
                  [3114, 3039, 3022, 3083, 3062, 3132, 3062, 2968, 3174, 2957, 2947, 3005, 3405, 3139, 3166, 2912, 2790, 2737, 2758],
                  133)
                }

                else if ( prop == "SI") {
                  paginaPopup(46.151241, 14.995463, 'Slovenia',
                  [11.96, 12.08, 14.31, 16.88, 20.89, 22.94, 22.58, 27.33, 33.45, 28.59, 28.84, 28.74, 26.97, 30.05, 36.41, 28.12, 29.91, 32.12, 10.94],
                  [1543, 1565, 1489, 1591, 1493, 1435, 1590, 1597, 1515, 1599, 1515, 1624, 1564, 1457, 1247, 1395, 1358, 1373, 4353],
                  [11.96, 12.08, 14.31, 16.88, 20.89, 22.94, 22.58, 27.33, 33.45, 28.59, 28.84, 28.74, 26.97, 30.05, 36.41, 28.12, 29.91, 32.12, 34.03],
                  [1543, 1565, 1489, 1591, 1493, 1435, 1590, 1597, 1515, 1599, 1515, 1624, 1564, 1457, 1247, 1395, 1358, 1373, 1400],
                  144)
                }

                else if ( prop == "SO") {
                  paginaPopup(5.152149, 46.199616, 'Somalia',
                  [0.16, 0.10, 0.09, 0.11, 0.12, 0.17, 0.17, 0.15, 0.14, 0.08, 0.07, 0.23, 0.22, 0.44, 0.45, 0.46, 0.41, 0.38, 0.28],
                  [9490, 9820, 10447, 10739, 11812, 10343, 10563, 12458, 13084, 13469, 14748, 13668, 15206, 13396, 13145, 13038, 14310, 17315, 15713],
                  [0.16, 0.10, 0.09, 0.11, 0.12, 0.17, 0.17, 0.15, 0.14, 0.08, 0.07, 0.23, 0.22, 0.44, 0.45, 0.46, 0.41, 0.38, 0.29],
                  [9490, 9820, 10447, 10739, 11812, 10343, 10563, 12458, 13084, 13469, 14748, 13668, 15206, 13396, 13145, 13038, 14310, 17315, 15583],
                  29)
                }

                else if ( prop == "ES") {
                  paginaPopup(40.463667, -3.74922, 'Spain',
                  [32.81, 35.84, 40.54, 49.63, 57.28, 62.43, 71.33, 84.31, 96.76, 93.85, 92.37, 94.88, 86.57, 84.20, 83.85, 72.04, 75.17, 80.23, 16.46],
                  [16541, 15999, 15931, 16697, 17044, 16902, 16139, 15917, 15289, 14496, 14066, 14233, 14005, 14678, 14903, 15079, 14937, 14847, 69946],
                  [32.81, 35.84, 40.54, 49.63, 57.28, 62.43, 71.33, 84.31, 96.76, 93.85, 92.37, 94.88, 86.57, 84.20, 83.85, 72.04, 75.17, 80.23, 71.17],
                  [16541, 15999, 15931, 16697, 17044, 16902, 16139, 15917, 15289, 14496, 14066, 14233, 14005, 14678, 14903, 15079, 14937, 14847, 16175],
                  118)
                }

                else if ( prop == "LK") {
                  paginaPopup(7.873054, 80.771797, 'Sri Lanka',
                  [0.89, 1.00, 1.12, 1.28, 0.36, 1.34, 1.98, 1.63, 1.56, 1.55, 2.33, 4.26, 4.49, 4.97, 5.17, 5.33, 5.37, 5.64, 5.08],
                  [16930, 14268, 13391, 13430, 51385, 16493, 12963, 18050, 23748, 24574, 22069, 13905, 13843, 13523, 13835, 13550, 13570, 13688, 14124],
                  [0.89, 1.00, 1.12, 1.28, 0.36, 1.34, 1.98, 1.63, 1.56, 1.55, 2.33, 4.26, 4.49, 4.97, 5.17, 5.33, 5.37, 5.64, 5.15],
                  [16930, 14268, 13391, 13430, 51385, 16493, 12963, 18050, 23748, 24574, 22069, 13905, 13843, 13523, 13835, 13550, 13570, 13688, 13920],
                  136)
                }

                else if ( prop == "US") {
                  paginaPopup(37.09024, -95.712891, 'United States',
                  [61.86, 60.39, 60.88, 62.80, 65.66, 67.51, 69.08, 71.07, 72.76, 72.98, 74.29, 74.42, 87.07, 78.05, 78.82, 76.51, 92.30, 95.13, 36.41],
                  [151268, 160099, 164112, 166857, 170067, 176388, 182314, 185125, 183816, 180171, 183636, 190048, 169273, 195710, 202296, 216689, 184446, 186401, 525727],
                  [61.86, 60.39, 60.88, 62.80, 65.66, 67.51, 69.08, 71.07, 72.76, 72.98, 74.29, 74.42, 87.07, 78.05, 78.82, 76.51, 92.30, 95.13, 106.14],
                  [151268, 160099, 164112, 166857, 170067, 176388, 182314, 185125, 183816, 180171, 183636, 190048, 169273, 195710, 202296, 216689, 184446, 186401, 180329],
                  150)
                }

                else if ( prop == "ZA") {
                  paginaPopup(-30.559482, 22.937506, 'South Africa',
                  [2.76, 2.43, 2.26, 3.37, 4.29, 4.87, 5.18, 5.53, 5.43, 6.00, 7.78, 8.94, 8.24, 7.83, 7.41, 6.25, 6.05, 6.97, 3.25],
                  [49424, 50048, 51115, 51944, 53342, 52962, 52464, 54125, 52831, 49357, 48238, 46560, 48127, 46821, 47324, 50817, 48964, 50099, 84476],
                  [2.76, 2.43, 2.26, 3.37, 4.29, 4.87, 5.18, 5.53, 5.43, 6.00, 7.78, 8.94, 8.24, 7.83, 7.41, 6.25, 6.05, 6.97, 4.87],
                  [49424, 50048, 51115, 51944, 53342, 52962, 52464, 54125, 52831, 49357, 48238, 46560, 48127, 46821, 47324, 50817, 48964, 50099, 56443],
                  86)
                }

                else if ( prop == "SD") {
                  paginaPopup(12.862807, 30.217636, 'Sudan',
                  [0.27, 0.40, 0.41, 0.46, 0.49, 0.85, 1.14, 1.47, 1.74, 1.67, 2.18, 2.41, 2.87, 2.97, 3.42, 4.44, 4.07, 5.62, 1.19],
                  [37610, 26733, 29165, 30734, 35676, 25083, 25239, 24853, 24734, 25081, 23654, 24493, 23719, 24305, 24050, 21789, 23460, 21897, 19977],
                  [0.27, 0.40, 0.41, 0.46, 0.49, 0.85, 1.14, 1.47, 1.74, 1.67, 2.18, 2.41, 2.87, 2.97, 3.42, 4.44, 4.07, 5.62, 1.29],
                  [37610, 26733, 29165, 30734, 35676, 25083, 25239, 24853, 24734, 25081, 23654, 24493, 23719, 24305, 24050, 21789, 23460, 21897, 18416],
                  49)
                }

                else if ( prop == "SSD") {
                  paginaPopup(6.856729, 29.4506773, 'South Sudan',
                  [0, 0, 0, 0,0, 0, 0, 0, 2.26, 1.25, 2.27, 1.64, 1.32, 1.32, 1.33, 1.47, 0.32, 3.06, 0.66],
                  [6642, 5473, 5612, 5612, 4961, 5031, 6387, 5952, 6878, 9775, 6935, 9912, 7977, 10494, 10388, 6677, 8139, 10341, 4850],
                  [0, 0, 0, 0,0, 0, 0, 0, 2.26, 1.25, 2.27, 1.64, 1.32, 1.32, 1.33, 1.47, 0.32, 3.06, 0.67],
                  [6642, 5473, 5612, 5612, 4961, 5031, 6387, 5952, 6878, 9775, 6935, 9912, 7977, 10494, 10388, 6677, 8139, 10341, 4787],
                  229)
                }

                else if ( prop == "SR") {
                  paginaPopup(3.919305, -56.027783, 'Suriname',
                  [3.51, 3.03, 3.89, 4.07, 4.36, 5.18, 7.94, 8.05, 8.88, 3.83, 11.56, 11.67, 14.87, 14.29, 15.64, 10.66, 7.04, 6.74, 6.13],
                  [270, 275, 281, 313, 340, 346, 331, 365, 398, 414, 378, 379, 335, 360, 335, 449, 450, 455, 565],
                  [3.51, 3.03, 3.89, 4.07, 4.36, 5.18, 7.94, 8.05, 8.88, 3.83, 11.56, 11.67, 14.87, 14.29, 15.64, 10.66, 7.04, 6.74, 7.79],
                  [270, 275, 281, 313, 340, 346, 331, 365, 398, 414, 378, 379, 335, 360, 335, 449, 450, 455, 445],
                  65)
                }

                else if ( prop == "SE") {
                  paginaPopup(60.128161, 18.643501, 'Sweden',
                  [61.94, 51.57, 55.95, 71.78, 74.70, 81.01, 90.97, 101.01, 106.98, 91.18, 104.94, 122.62, 116.32, 120.30, 118.66, 97.38, 105.24,116.26, 33.28],
                  [4200, 4659, 4725, 4619, 5116, 4808, 4623, 4835, 4810, 4717, 4659, 4598, 4681, 4816, 4841, 5115, 4867, 4607, 14341],
                  [61.94, 51.57, 55.95, 71.78, 74.70, 81.01, 90.97, 101.01, 106.98, 91.18, 104.94, 122.62, 116.32, 120.30, 118.66, 97.38, 105.24,116.26, 101.83],
                  [4200, 4659, 4725, 4619, 5116, 4808, 4623, 4835, 4810, 4717, 4659, 4598, 4681, 4816, 4841, 5115, 4867, 4607, 4686],
                  36)
                }

                else if ( prop == "CH") {
                  paginaPopup(46.818188, 8.227512, 'Switzerland',
                  [66.97, 59.57, 82.03, 96.81, 110.65, 117.73, 115.75, 127.05, 152.19, 151.09, 163.83, 190.20, 168.65, 180.94, 192.41, 177.85, 171.51, 174.36, 57.87],
                  [4084, 4659, 3653, 3621, 3541, 3458, 3721, 3782, 3642, 3581, 3566, 3640, 3974, 3819, 3696, 3827, 3902, 3888, 11786],
                  [66.97, 59.57, 82.03, 96.81, 110.65, 117.73, 115.75, 127.05, 152.19, 151.09, 163.83, 190.20, 168.65, 180.94, 192.41, 177.85, 171.51, 174.36, 159.19],
                  [4084, 4659, 3653, 3621, 3541, 3458, 3721, 3782, 3642, 3581, 3566, 3640, 3974, 3819, 3696, 3827, 3902, 3888, 4284],
                  13)
                }

                else if ( prop == "SZ") {
                  paginaPopup(-26.522503, 31.465866, 'Eswatini',
                  [1.39, 0.40, 1.03, 1.09, 1.86, 2.13, 2.20, 2.30, 2.14, 2.31, 2.86, 3.15, 3.15, 3.00, 2.92, 2.63, 2.63, 3.21, 2.66],
                  [1181, 3681, 1308, 1348, 1396, 1392, 1386, 1384, 1391, 1391, 1373, 1340, 1325, 1301, 1267, 1278, 1173, 1130, 1354],
                  [1.39, 0.40, 1.03, 1.09, 1.86, 2.13, 2.20, 2.30, 2.14, 2.31, 2.86, 3.15, 3.15, 3.00, 2.92, 2.63, 2.63, 3.21, 3.08],
                  [1181, 3681, 1308, 1348, 1396, 1392, 1386, 1384, 1391, 1391, 1373, 1340, 1325, 1301, 1267, 1278, 1173, 1130, 1169],
                  153)
                }

                else if ( prop == "TJ") {
                  paginaPopup(38.861034, 71.276093, 'Tajikistan',
                  [1.00, 1.00, 0.78, 7.73, 1.16, 1.42, 1.07, 1.39, 1.92, 1.79, 1.88, 2.25, 2.61, 1.87, 3.01, 2.55, 7.15, 2.26, 2.41],
                  [1590, 1181, 1564, 1710, 1789, 1632, 2651, 2680, 2693, 2780, 3006, 2894, 2930, 2939, 3025, 3086, 973, 3173, 3089],
                  [1.00, 1.00, 0.78, 7.73, 1.16, 1.42, 1.07, 1.39, 1.92, 1.79, 1.88, 2.25, 2.61, 1.87, 3.01, 2.55, 7.15, 2.26, 2.49],
                  [1590, 1181, 1564, 1710, 1789, 1632, 2651, 2680, 2693, 2780, 3006, 2894, 2930, 2939, 3025, 3086, 973, 3173, 2999],
                  122)
                }
                else if ( prop == "TW") {
                  paginaPopup(23.69781, 120.960515, 'Taiwan',
                  [21.31, 19.83, 21.11, 22.34, 24.01, 25.32, 27.20, 29.91, 31.50, 29.37, 35.81, 38.06, 41.22, 42.27, 42.81, 43.16, 41.87, 45.05, 54.98],
                  [15338, 14947, 14463, 14146, 14438, 14800, 14273, 13630, 13227, 13342, 12474, 12784, 12564, 12128, 12424, 12213, 12734, 12816, 12663],
                  [21.31, 19.83, 21.11, 22.34, 24.01, 25.32, 27.20, 29.91, 31.50, 29.37, 35.81, 38.06, 41.22, 42.27, 42.81, 43.16, 41.87, 45.05, 55.01],
                  [15338, 14947, 14463, 14146, 14438, 14800, 14273, 13630, 13227, 13342, 12474, 12784, 12564, 12128, 12424, 12213, 12734, 12816, 12656],
                  19)
                }

                else if ( prop == "TZ") {
                  paginaPopup(-6.369028, 34.888822, 'Tanzania',
                  [0.84, 0.84, 0.81, 0.93, 1.01, 1.11, 1.08, 1.24, 1.55, 1.57, 1.71, 1.79, 1.99, 2.25, 2.46, 2.25, 2.36, 2.47, 2.55],
                  [16475, 16565, 17945, 16765, 16963, 17104, 17774, 18167, 18536, 19087, 19240, 19992, 20507, 20918, 20939, 21690, 21768, 22208, 22974],
                  [0.84, 0.84, 0.81, 0.93, 1.01, 1.11, 1.08, 1.24, 1.55, 1.57, 1.71, 1.79, 1.99, 2.25, 2.46, 2.25, 2.36, 2.47, 2.55],
                  [16475, 16565, 17945, 16765, 16963, 17104, 17774, 18167, 18536, 19087, 19240, 19992, 20507, 20918, 20939, 21690, 21768, 22208, 22953],
                  88)
                }

                else if ( prop == "TH") {
                  paginaPopup(15.870032, 100.992541, 'Thailand',
                  [0.84, 0.98, 0.95, 1.12, 2.51, 4.29, 5.75, 6.43, 10.74, 8.00, 9.92, 13.94, 16.01, 13.30, 9.31, 6.93, 5.45, 5.34, 9.52],
                  [40867, 66235, 42803, 45137, 44196, 43160, 44442, 42884, 41787, 41943, 39924, 40682, 40130, 39411, 38451, 38617, 39558, 48268, 47981],
                  [0.84, 0.98, 0.95, 1.12, 2.51, 4.29, 5.75, 6.43, 10.74, 8.00, 9.92, 13.94, 16.01, 13.30, 9.31, 6.93, 5.45, 5.34, 9.53],
                  [40867, 66235, 42803, 45137, 44196, 43160, 44442, 42884, 41787, 41943, 39924, 40682, 40130, 39411, 38451, 38617, 39558, 48268, 47920],
                  50)
                }

                else if ( prop == "TL") {
                  paginaPopup(-8.874217, 125.727539, 'East Timor',
                  [0.53, 0.51, 0.57, 0.69, 0.64, 0.63, 0.74, 0.79, 0.99, 0.98, 0.98, 1.09, 1.09, 1.69, 1.26, 1.18, 1.25, 1.33, 3.39],
                  [523, 531, 540, 484, 430, 423, 462, 448, 409, 400, 403, 407, 416, 424, 434, 446, 459, 466, 489],
                  [0.53, 0.51, 0.57, 0.69, 0.64, 0.63, 0.74, 0.79, 0.99, 0.98, 0.98, 1.09, 1.09, 1.69, 1.26, 1.18, 1.25, 1.33, 3.39],
                  [523, 531, 540, 484, 430, 423, 462, 448, 409, 400, 403, 407, 416, 424, 434, 446, 459, 466, 489],
                  160)
                }

                else if ( prop == "TG") {
                  paginaPopup(8.619543, 0.824782, 'Togo',
                  [0.53, 0.51, 0.57, 0.69, 0.64, 0.63, 0.74, 0.79, 0.99, 0.98, 0.98, 1.09, 1.09, 1.69, 1.26, 1.18, 1.25, 1.33, 1.68],
                  [2817, 2881, 2994, 3056, 3539, 3631, 3194, 3379, 3358, 3432, 3500, 3561, 3553, 2549, 3625, 3541, 3542, 3579, 4096],
                  [0.53, 0.51, 0.57, 0.69, 0.64, 0.63, 0.74, 0.79, 0.99, 0.98, 0.98, 1.09, 1.09, 1.69, 1.26, 1.18, 1.25, 1.33, 1.71],
                  [2817, 2881, 2994, 3056, 3539, 3631, 3194, 3379, 3358, 3432, 3500, 3561, 3553, 2549, 3625, 3541, 3542, 3579, 4082],
                  117)
                }

                else if ( prop == "TO") {
                  paginaPopup(-21.178986, -175.198242, 'Tonga',
                  [4.78, 4.25, 4.15, 4.60, 5.21, 5.83, 6.54, 6.52, 7.77, 2.47, 8.03, 9.20, 10.27, 10.02, 9.65, 9.68, 9.12, 9.78, 13.86],
                  [42, 43, 44, 44, 44, 45, 45, 46, 45, 129, 46, 46, 46, 45, 46, 45, 44, 44, 35],
                  [4.78, 4.25, 4.15, 4.60, 5.21, 5.83, 6.54, 6.52, 7.77, 2.47, 8.03, 9.20, 10.27, 10.02, 9.65, 9.68, 9.12, 9.78, 13.86],
                  [42, 43, 44, 44, 44, 45, 45, 46, 45, 129, 46, 46, 46, 45, 46, 45, 44, 44, 35],
                  182)
                }

                else if ( prop == "TT") {
                  paginaPopup(10.691803, -61.222503, 'Trinidad e Tobago',
                  [16.51, 11.07, 12.62, 13.54, 14.61, 16.09, 17.73, 19.48, 20.31, 16.47, 19.66, 25.36, 26.59, 27.69, 28.50, 26.64, 23.09, 23.62, 19.40],
                  [494, 797, 714, 835, 909, 993, 1036, 1111, 1372, 1164, 1127, 1003, 969, 979, 964, 943, 942, 942, 1010],
                  [16.51, 11.07, 12.62, 13.54, 14.61, 16.09, 17.73, 19.48, 20.31, 16.47, 19.66, 25.36, 26.59, 27.69, 28.50, 26.64, 23.09, 23.62, 22.17],
                  [494, 797, 714, 835, 909, 993, 1036, 1111, 1372, 1164, 1127, 1003, 969, 979, 964, 943, 942, 942, 884],
                  171)
                }

                else if ( prop == "TN") {
                  paginaPopup(33.886917, 9.537499, 'Tunisia',
                  [3.47, 3.58, 3.73, 4.29, 5.04, 5.31, 5.66, 6.43, 7.49, 31.44, 7.43, 7.31, 7.71, 38.64, 8.11, 7.31, 7.17, 6.93, 3.70],
                  [6191, 6160, 6197, 6395, 6193, 6078, 6073, 6049, 5988, 6048, 5930, 6271, 5839, 5875, 5872, 5902, 5831, 5762, 9642],
                  [3.47, 3.58, 3.73, 4.29, 5.04, 5.31, 5.66, 6.43, 7.49, 31.44, 7.43, 7.31, 7.71, 38.64, 8.11, 7.31, 7.17, 6.93, 7.11],
                  [6191, 6160, 6197, 6395, 6193, 6078, 6073, 6049, 5988, 6048, 5930, 6271, 5839, 5875, 5872, 5902, 5831, 5762, 5022],
                  83)
                }

                else if ( prop == "TR") {
                  paginaPopup(38.963745, 35.243322, 'Turkey',
                  [12.39, 9.55, 12.67, 15.57, 20.57, 25.48, 28.22, 34.59, 39.45, 57.10, 59.46, 65.60, 66.35, 48.48, 46.36, 45.41, 33.59, 32.93, 15.29],
                  [22028, 20966, 18815, 20025, 19679, 19680, 19580, 19536, 19374, 11289, 12981, 12690, 13173, 19608, 20152, 18933, 25710, 25861, 42868],
                  [12.39, 9.55, 12.67, 15.57, 20.57, 25.48, 28.22, 34.59, 39.45, 57.10, 59.46, 65.60, 66.35, 48.48, 46.36, 45.41, 33.59, 32.93, 29.48],
                  [22028, 20966, 18815, 20025, 19679, 19680, 19580, 19536, 19374, 11289, 12981, 12690, 13173, 19608, 20152, 18933, 25710, 25861, 22226],
                  37)
                }

                else if ( prop == "TM") {
                  paginaPopup(38.969719, 59.556278, 'Turkmenistan',
                  [1.5, 1.68, 1.86, 2.72, 3.08, 3.50, 5.23, 6.17, 5.22, 12.90, 13.97, 19.83, 27.73, 25.11, 37.07, 28.66, 2.03, 21.46, 29.14],
                  [1934, 2104, 2395, 2194, 2218, 2313, 2431, 2054, 3692, 1567, 1616, 1474, 1268, 1561, 1174, 1249, 17789, 1767, 1701],
                  [1.5, 1.68, 1.86, 2.72, 3.08, 3.50, 5.23, 6.17, 5.22, 12.90, 13.97, 19.83, 27.73, 25.11, 37.07, 28.66, 2.03, 21.46, 29.14],
                  [1934, 2104, 2395, 2194, 2218, 2313, 2431, 2054, 3692, 1567, 1616, 1474, 1268, 1561, 1174, 1249, 17789, 1767, 1701],
                  141)
                }
                else if ( prop == "TC") {
                  paginaPopup(21.694025, -71.797928, 'Turks and Cacois',
                  [64.52, 44.86, 45.84, 68.29, 80.93, 34.04, 48.53, 45.50, 71.89, 36.04, 31.22, 34.70, 31.12, 25.54, 82.40, 68.73, 63.36, 60.16, 140.22],
                  [15, 17, 12, 27, 22, 21, 23, 29, 10, 13, 15, 16, 15, 16, 9, 11, 12, 13, 6],
                  [64.52, 44.86, 45.84, 68.29, 80.93, 34.04, 48.53, 45.50, 71.89, 36.04, 31.22, 34.70, 31.12, 25.54, 82.40, 68.73, 63.36, 60.16, 140.22],
                  [15, 17, 12, 27, 22, 21, 23, 29, 10, 13, 15, 16, 15, 16, 9, 11, 12, 13, 6],
                  192)
                }

                else if ( prop == "TV") {
                  paginaPopup(-7.109535, 177.64933, 'Tuvalu', ['nd'], ['nd'], 220)
                }

                else if ( prop == "UA") {
                  paginaPopup(48.379433, 31.16558, 'Ukraine',
                  [0.42, 0.50, 0.55, 0.69, 0.91, 1.23, 1.67, 2.16, 2.93, 2.39, 3.09, 3.85, 4.21, 5.10, 3.50, 2.78, 2.15, 2.65, 2.37],
                  [73575, 75321, 76311, 72576, 71229, 69954, 64556, 65978, 61377, 48936, 43955, 42380, 41713, 35947, 40135, 34569, 45689, 44736, 62468],
                  [0.42, 0.50, 0.55, 0.69, 0.91, 1.23, 1.67, 2.16, 2.93, 2.39, 3.09, 3.85, 4.21, 5.10, 3.50, 2.78, 2.15, 2.65, 3.38],
                  [73575, 75321, 76311, 72576, 71229, 69954, 64556, 65978, 61377, 48936, 43955, 42380, 41713, 35947, 40135, 34569, 45689, 44736, 43935],
                  17)
                }

                else if ( prop == "UG") {
                  paginaPopup(1.373333,32.290275, 'Uganda',
                  [0.39, 0.40, 0.37, 0.35, 0.44, 0.57, 0.65, 0.82, 0.95, 1.22, 1.30, 1.33, 1.49, 1.53, 1.66, 1.72, 1.52, 1.64, 2.07],
                  [15975, 14560, 16815, 18065, 17951, 15938, 15324, 15076, 14986, 14909, 15509, 15164, 15500, 16056, 16481, 15749, 15862, 15864, 16456],
                  [0.39, 0.40, 0.37, 0.35, 0.44, 0.57, 0.65, 0.82, 0.95, 1.22, 1.30, 1.33, 1.49, 1.53, 1.66, 1.72, 1.52, 1.64, 2.10],
                  [15975, 14560, 16815, 18065, 17951, 15938, 15324, 15076, 14986, 14909, 15509, 15164, 15500, 16056, 16481, 15749, 15862, 15864, 16207],
                  38)
                }

                else if ( prop == "HU") {
                  paginaPopup(47.162494, 19.503304, 'Hungary',
                  [4.96, 5.69, 7.12, 9.04, 11.44, 14.31, 15.18, 18.80, 21.45, 18.10, 18.51, 20.95, 19.61, 22.08, 55.65, 20.58, 22.11, 23.68, 9.02],
                  [9541, 9455, 9513, 9435, 9099, 7900, 7596, 7438, 7366, 7178, 7073, 6719, 6519, 6124, 2517, 5979, 5699, 5901, 15490],
                  [4.96, 5.69, 7.12, 9.04, 11.44, 14.31, 15.18, 18.80, 21.45, 18.10, 18.51, 20.95, 19.61, 22.08, 55.65, 20.58, 22.11, 23.68, 23.48],
                  [9541, 9455, 9513, 9435, 9099, 7900, 7596, 7438, 7366, 7178, 7073, 6719, 6519, 6124, 2517, 5979, 5699, 5901, 5953],
                  120)
                }

                else if ( prop == "UY") {
                  paginaPopup(-32.522779, -55.765835, 'Uruguay',
                  [15.59, 11.16, 6.77, 6.61, 7.21, 8.73, 9.95, 11.14, 14.92, 15.50, 18.73, 19.26, 21.95, 23.79, 23.99, 22.28, 20.88, 22.55, 18.78],
                  [1464, 1873, 2009, 1821, 1899, 1990, 1968, 2102, 2035, 2042, 2151, 2490, 2336, 2418, 2386, 2391, 2523, 2505, 2599],
                  [15.59, 11.16, 6.77, 6.61, 7.21, 8.73, 9.95, 11.14, 14.92, 15.50, 18.73, 19.26, 21.95, 23.79, 23.99, 22.28, 20.88, 22.55, 20.07],
                  [1464, 1873, 2009, 1821, 1899, 1990, 1968, 2102, 2035, 2042, 2151, 2490, 2336, 2418, 2386, 2391, 2523, 2505, 2431],
                  109)
                }

                else if ( prop == "VA") {
                  paginaPopup(41.902916, 12.453389, 'Vatican City', ['nd'], ['nd'], 152)
                }

                else if ( prop == "AQ") {
                  paginaPopup(-76.300003, -148.000000, 'Antarctica', ['nd'], ['nd'], 225)
                }

                else if ( prop == "GL") {
                  paginaPopup(78.858609, -55.232972, 'Groenlandia', ['nd'], ['nd'], 55)
                }

                else if ( prop == "UZ") {
                  paginaPopup(41.377491, 64.585262, 'Uzbekistan',
                  [1.36, 1.07, 0.91, 1.16, 6.40, 1.41, 1.31, 1.71, 2.31, 3.86, 4.62, 5.35, 4.06, 6.09, 8.30, 6.33, 6.32, 4.58, 3.23],
                  [10087, 10665, 10496, 8702, 1880, 10142, 13265, 13067, 12817, 8739, 8516, 8589, 12768, 9473, 9208, 12920, 12938, 12930, 15886],
                  [1.36, 1.07, 0.91, 1.16, 6.40, 1.41, 1.31, 1.71, 2.31, 3.86, 4.62, 5.35, 4.06, 6.09, 8.30, 6.33, 6.32, 4.58, 3.36],
                  [10087, 10665, 10496, 8702, 1880, 10142, 13265, 13067, 12817, 8739, 8516, 8589, 12768, 9473, 9208, 12920, 12938, 12930, 15272],
                  154)
                }

                else if ( prop == "VU") {
                  paginaPopup(-15.376706, 166.95915, 'Vanuatu',
                  [1.97, 1.77, 1.76, 2.06, 2.35, 2.47, 2.68, 3.10, 3.49, 3.43, 3.89, 4.33, 4.25, 4.29, 2.78, 3.60, 3.96, 4.51, 3.78],
                  [138, 146, 149, 153, 155, 160, 164, 170, 174, 178, 180, 183, 184, 187, 293, 205, 199, 202, 206],
                  [1.97, 1.77, 1.76, 2.06, 2.35, 2.47, 2.68, 3.10, 3.49, 3.43, 3.89, 4.33, 4.25, 4.29, 2.78, 3.60, 3.96, 4.51, 3.78],
                  [138, 146, 149, 153, 155, 160, 164, 170, 174, 178, 180, 183, 184, 187, 293, 205, 199, 202, 206],
                  162)
                }

                else if ( prop == "VE") {
                  paginaPopup(6.42375, -66.58973, 'Venezuela',
                  [5.84, 5.84, 3.96, 3.30, 4.78, 6.33, 7.27, 8.20, 10.53, 11.22, 14.34, 11.60, 12.58, 12.76, 16.37, 12.53, 9.54, 7.71, 1.56],
                  [20068, 21036, 23441, 25356, 23517, 22980, 25236, 28088, 30001, 29389, 27427, 27292, 30308, 29069, 29474, 29624, 28893, 30326, 25515],
                  [5.84, 5.84, 3.96, 3.30, 4.78, 6.33, 7.27, 8.20, 10.53, 11.22, 14.34, 11.60, 12.58, 12.76, 16.37, 12.53, 9.54, 7.71, 1.63],
                  [20068, 21036, 23441, 25356, 23517, 22980, 25236, 28088, 30001, 29389, 27427, 27292, 30308, 29069, 29474, 29624, 28893, 30326, 24494],
                  43)
                }

                else if ( prop == "VN") {
                  paginaPopup(14.058324, 108.277199, 'Vietnam',
                  [0.59, 0.62, 0.65, 0.72, 0.81, 1.01, 1.14, 1.30, 1.63, 1.72, 1.88, 2.19, 2.51, 2.74, 2.98, 3.07, 3.24, 3.52, 4.02],
                  [52613, 53033, 53656, 54779, 55979, 57097, 58318, 59585, 60727, 61511, 61655, 61840, 61975, 62515, 62441, 62894, 63295, 63559, 61387],
                  [0.59, 0.62, 0.65, 0.72, 0.81, 1.01, 1.14, 1.30, 1.63, 1.72, 1.88, 2.19, 2.51, 2.74, 2.98, 3.07, 3.24, 3.52, 4.02],
                  [52613, 53033, 53656, 54779, 55979, 57097, 58318, 59585, 60727, 61511, 61655, 61840, 61975, 62515, 62441, 62894, 63295, 63559, 61352],
                  91)
                }

                else if ( prop == "YE") {
                  paginaPopup(15.552727, 48.516388, 'Yemen',
                  [0.60, 0.61, 0.65, 0.71, 0.84, 1.02, 1.17, 1.27, 1.59, 1.49, 1.81, 1.77, 1.80, 2.28, 2.12, 1.62, 0.93, 0.78, 0.60],
                  [16180, 16190, 16420, 16557, 16508, 16429, 16303, 17029, 16915, 16901, 17070, 18444, 19670, 17719, 20360, 26325, 33406, 34262, 34233],
                  [0.60, 0.61, 0.65, 0.71, 0.84, 1.02, 1.17, 1.27, 1.59, 1.49, 1.81, 1.77, 1.80, 2.28, 2.12, 1.62, 0.93, 0.78, 0.61],
                  [16180, 16190, 16420, 16557, 16508, 16429, 16303, 17029, 16915, 16901, 17070, 18444, 19670, 17719, 20360, 26325, 33406, 34262, 33622],
                  8)
                }

                else if ( prop == "ZM") {
                  paginaPopup(-13.133897, 27.849332, 'Zambia',
                  [0.54, 0.61, 0.69, 0.76, 0.97, 1.27, 1.93, 2.09, 2.62, 2.24, 2.93, 3.28, 3.58, 3.90, 3.76, 2.87, 2.79,3.49, 1.98],
                  [6727, 6672, 6377, 6434, 6420, 6584, 6625, 6724, 6832, 6832, 6923, 7157, 7129, 7183, 7223, 7376, 7524, 7404, 8881],
                  [0.54, 0.61, 0.69, 0.76, 0.97, 1.27, 1.93, 2.09, 2.62, 2.24, 2.93, 3.28, 3.58, 3.90, 3.76, 2.87, 2.79,3.49, 2.07],
                  [6727, 6672, 6377, 6434, 6420, 6584, 6625, 6724, 6832, 6832, 6923, 7157, 7129, 7183, 7223, 7376, 7524, 7404, 8495],
                  60)
                }

                else if ( prop == "ZW") {
                  paginaPopup(-19.015438, 29.154857, 'Zimbabwe',
                  [0.65, 0.63, 0.56, 0.49, 0.50, 0.49, 0.46, 0.45, 0.36, 0.82, 1.04, 1.24, 1.56, 1.75, , 1.87, 1.91, 2.12, 1.30],
                  [10326, 10712, 11352, 11588, 11726, 11643, 11792, 11755, 12200, 11804, 11563, 11337, 10958, 10900, 10657, 10681, 10735, 10759, 11757],
                  [0.65, 0.63, 0.56, 0.49, 0.50, 0.49, 0.46, 0.45, 0.36, 0.82, 1.04, 1.24, 1.56, 1.75, , 1.87, 1.91, 2.12, 1.34],
                  [10326, 10712, 11352, 11588, 11726, 11643, 11792, 11755, 12200, 11804, 11563, 11337, 10958, 10900, 10657, 10681, 10735, 10759, 11397],
                  135)
                }
          }
        }
    } // end for loop

    lookupContext.clearRect(0,0,256,1);

    for (var i = 0; i <= 229; i++) {
      if (i == 0) {
        lookupContext.fillStyle = "rgba(0,0,0,1.0)"
      } else if (i == countryCode) {
        lookupContext.fillStyle = "rgba(240,48,104,0.6)"


      } else {
        lookupContext.fillStyle = "rgba(0,0,0,1.0)"
      }
      lookupContext.fillRect(i, 0, 1, 1 );
    }
    lookupTexture.needsUpdate = true;
  }
  }

  function onMouseDown(event) {
    event.preventDefault();

    container.addEventListener('mousemove', onMouseMove, false);
    container.addEventListener('mouseup', onMouseUp, false);
    container.addEventListener('mouseout', onMouseOut, false);

    container.addEventListener('touchend', _onTouchEnd, false);
    container.addEventListener('touchmove', _onTouchMove, false);
    container.addEventListener('click', _onClick, false);


    mouseOnDown.x = -event.clientX;
    mouseOnDown.y = event.clientY;

    targetOnDown.x = target.x;
    targetOnDown.y = target.y;

    // container.style.cursor = 'move';

  }


  function onMouseMove(event) {

    mouse.x = -event.clientX;
    mouse.y = event.clientY;

    var zoomDamp = distance / 1000;

    target.x = targetOnDown.x + (mouse.x - mouseOnDown.x) * 0.005 * zoomDamp;
    target.y = targetOnDown.y + (mouse.y - mouseOnDown.y) * 0.005 * zoomDamp;

    target.y = target.y > PI_HALF ? PI_HALF : target.y;
    target.y = target.y < -PI_HALF ? -PI_HALF : target.y;

  }

  function onMouseUp(event) {
    container.removeEventListener('mousemove', onMouseMove, false);
    container.removeEventListener('mouseup', onMouseUp, false);
    container.removeEventListener('mouseout', onMouseOut, false);
    container.removeEventListener('touchend', _onTouchEnd, false);
    container.removeEventListener('touchmove', _onTouchMove, false);


}

  function onMouseOut(event) {
    container.removeEventListener('mousemove', onMouseMove, false);
    container.removeEventListener('mouseup', onMouseUp, false);
    container.removeEventListener('mouseout', onMouseOut, false);
  }

  function onMouseWheel(event) {
    event.preventDefault();
    if (overRenderer) {
      zoom(event.wheelDeltaY * 0.3);
    }
    return false;
  }

  function onDocumentKeyDown(event) {
    switch (event.keyCode) {
      case 38:
        zoom(100);
        event.preventDefault();
        break;
      case 40:
        zoom(-100);
        event.preventDefault();
        break;
    }
  }

  function onWindowResize(event) {
    if (pinchZoomEnabled) {

    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();

    renderer.setSize( window.innerWidth, window.innerHeight );
  } else {

    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();

    renderer.setSize( window.innerWidth, window.innerHeight );
  }
  }


  function zoom(delta) {
    distanceTarget -= delta;
    distanceTarget = distanceTarget > 3000 ? 3000 : distanceTarget; //____________________________________________DISTANZA DA GLOBO
    distanceTarget = distanceTarget < 350 ? 350 : distanceTarget;
  }


  document.getElementById('insbutton').onclick = function() {
    zoom(-2300)
    document.getElementById("popup").style.display = "none";
    document.getElementById("ins0").style.display= "block";
    document.getElementById("insbutton").style.display = "none";
    slideIndex = 0;
    showSlides(slideIndex);
    $('#intro').fadeOut();
    lookupContext.clearRect(0,0,256,1);
    lookupTexture.needsUpdate = true;
    document.getElementById('zoominButton').style.display = "block"
    document.getElementById('zoomoutButton').style.display = "block"
  }


  document.getElementById('zoominButton').onclick = function() {
    zoom(100);
  }

  document.getElementById('zoomoutButton').onclick = function() {
    zoom(-100);
  }

  function animate() {
    requestAnimationFrame(animate);
    render();
  }
  // dichiaro variabili per il popup
    var modal = document.getElementById("popup");
    var span = document.getElementsByClassName("close")[0];
    span.onclick = function() {
      zoom(-2300);
      modal.style.display = "none";
      document.getElementById('zoominButton').style.display = "block"
      document.getElementById('zoomoutButton').style.display = "block"

      lookupContext.clearRect(0,0,256,1);
      lookupTexture.needsUpdate = true;
    }
    window.onclick = function(event) {
      if (event.target == modal) {
        zoom(-2300);
        modal.style.display = "none";
        lookupContext.clearRect(0,0,256,1);
        lookupTexture.needsUpdate = true;
      }
    }

    var loader = new THREE.TextureLoader();
        loader.crossOrigin = '';


    function paginaPopup(lt, lg, titolo, dati, morti, datiSC, mortiSC, code) {
      var phi = lt * Math.PI / 180;
      var theta =	lg * Math.PI / 180;
      target.x = Math.PI / 2 + theta;
      target.y = phi;

      var url = 'write_file.php'; // url of a php file that JUST processes the file write
      $.ajax({
        type: "POST",
        url: url,
        data: {
              'country' : titolo
          }
      });

      document.getElementById('chartAF').style.opacity = '1';
      document.getElementById('chartDE').style.opacity = '1';
      document.getElementById('chartND1').style.opacity = '0';
      document.getElementById('chartND2').style.opacity = '0';

      zoom(-2300);
      zoom(2300);

      document.getElementById('titolo').innerHTML = "";   //resetto il titolo
      modal.style.display = "block";                      //mostro il popup
      document.getElementById('titolo').innerHTML = titolo;  //aggiorno il titolo
      chart.data.datasets[0].data = dati;
      chart.data.datasets[1].data = datiSC;                   // grafico 1
      chart.update();
      deathsChart.data.datasets[0].data = morti;
      deathsChart.data.datasets[1].data = mortiSC;            // grafico 2
      deathsChart.update();

      var allValue = chart.data.datasets[0].data          //testi
      var valMax = Math.max(...allValue);
      var valMin = Math.min(...allValue);
      var lastVal = allValue[allValue.length - 1];
      var sum = allValue.reduce(function(a, b) { return a + b; });
      var avg = Math.round(sum / allValue.length * 100) / 100;

      document.getElementById('max').innerHTML = valMax + ' €';
      document.getElementById('min').innerHTML = valMin + ' €';
      document.getElementById('last').innerHTML = lastVal + ' €';
      document.getElementById('media').innerHTML = avg + ' €';

      var annoMax = dati.indexOf(valMax);
      var annoMin = dati.indexOf(valMin);
      if (annoMax < 10) {
        document.getElementById('annoMax').innerHTML = '(200'+ annoMax + ')';
      }
      if (annoMin < 10) {
        document.getElementById('annoMin').innerHTML = '(200'+ annoMin + ')';
      }
      if (annoMax >= 10) {
        document.getElementById('annoMax').innerHTML = '(20'+ annoMax + ')';
      }
      if (annoMin >= 10) {
        document.getElementById('annoMin').innerHTML = '(20'+ annoMin + ')';
      }

      lookupContext.clearRect(0,0,256,1);
      lookupContext.fillStyle = "rgba(240,48,104,0.6)"
      lookupContext.fillRect( code, 0, 1, 1 );
      lookupTexture.needsUpdate = true;

      var allValue2 = deathsChart.data.datasets[0].data;        //testi
      var valMax2 = Math.max(...allValue2);
      if (valMax2 <= 15000) {
          deathsChart.options.scales.yAxes[0].ticks.max = 15000;
          deathsChart.options.scales.yAxes[0].ticks.stepSize = 15000 / 4;
          deathsChart.update()
      } else if ((valMax2 > 15000) && (valMax2 <= 80000)) {
          deathsChart.options.scales.yAxes[0].ticks.max = 80000;
          deathsChart.options.scales.yAxes[0].ticks.stepSize = 80000 / 4;
          deathsChart.update()
      } else if ((valMax2 > 80000) && (valMax2 < 300000)) {
          deathsChart.options.scales.yAxes[0].ticks.max = 300000;
          deathsChart.options.scales.yAxes[0].ticks.stepSize = 300000 / 4;
          deathsChart.update()
      } else if ((valMax2 > 300000) && (valMax2 < 500000)) {
          deathsChart.options.scales.yAxes[0].ticks.max = 500000;
          deathsChart.options.scales.yAxes[0].ticks.stepSize = 500000 / 4;
          deathsChart.update()
      } else if ((valMax2 > 500000) && (valMax2 < 800000)) {
          deathsChart.options.scales.yAxes[0].ticks.max = 800000;
          deathsChart.options.scales.yAxes[0].ticks.stepSize = 800000 / 4;
          deathsChart.update()
      } else if (valMax2 >= 800000) {
          deathsChart.options.scales.yAxes[0].ticks.max = 1000000;
          deathsChart.options.scales.yAxes[0].ticks.stepSize = 1000000 / 4;
          deathsChart.update()
      }
      var valMin2 = Math.min(...allValue2);
      var lastVal2 = allValue2[allValue2.length - 1];
      var sum2 = allValue2.reduce(function(a, b) { return a + b; });
      var avg2 = Math.round(sum2 / allValue2.length);

      document.getElementById('max_d').innerHTML = valMax2;
      document.getElementById('min_d').innerHTML = valMin2;
      document.getElementById('last_d').innerHTML = lastVal2;
      document.getElementById('media_d').innerHTML = avg2;

      var mortiMax = morti.indexOf(valMax2);
      var mortiMin = morti.indexOf(valMin2);
      if (mortiMax < 10) {
        document.getElementById('mortiMax').innerHTML = '(200'+ mortiMax + ')';
        document.getElementById('mortiMax').classList.remove("blink");
        document.getElementById('annoMin').classList.remove("blink");
      }
      if (mortiMin < 10) {
        document.getElementById('mortiMin').innerHTML = '(200'+ mortiMin + ')';
        document.getElementById('mortiMax').classList.remove("blink");
        document.getElementById('annoMin').classList.remove("blink");
      }
      if (mortiMax >= 10) {
        document.getElementById('mortiMax').innerHTML = '(20'+ mortiMax + ')';
        document.getElementById('mortiMax').classList.remove("blink");
        document.getElementById('annoMin').classList.remove("blink");
      }
      if (mortiMin >= 10) {
        document.getElementById('mortiMin').innerHTML = '(20'+ mortiMin + ')';
        document.getElementById('mortiMax').classList.remove("blink");
        document.getElementById('annoMin').classList.remove("blink");
      }

      if (mortiMax == 18) {
        document.getElementById('mortiMax').innerHTML = '(COVID - 2020)';
        document.getElementById('mortiMax').classList.add("blink");
      }

      if (annoMin == 18) {
        document.getElementById('annoMin').innerHTML = '(COVID - 2020)';
        document.getElementById('annoMin').classList.add("blink");
      }

      if (dati == 'nd' || morti == 'nd') {
        document.getElementById('max').innerHTML = 'N/D';
        document.getElementById('min').innerHTML = 'N/D';
        document.getElementById('last').innerHTML = 'N/D';
        document.getElementById('media').innerHTML = 'N/D';
        document.getElementById('annoMax').innerHTML = '(N/D)';
        document.getElementById('annoMin').innerHTML = '(N/D)';

        document.getElementById('max_d').innerHTML = 'N/D';
        document.getElementById('min_d').innerHTML = 'N/D';
        document.getElementById('last_d').innerHTML = 'N/D';
        document.getElementById('media_d').innerHTML = 'N/D';
        document.getElementById('mortiMax').innerHTML = '(N/D)';
        document.getElementById('mortiMin').innerHTML = '(N/D)';

        document.getElementById('chartAF').style.opacity = '0.4';
        document.getElementById('chartDE').style.opacity = '0.4';
        document.getElementById('chartND1').style.opacity = '1';
        document.getElementById('chartND2').style.opacity = '1';
      }

      chart.options.scales.yAxes[0].ticks.max = 250;
      chart.options.scales.yAxes[0].ticks.stepSize = 25;
      chart.update()

      if (titolo == 'Qatar' || titolo == 'Singapore' || titolo == 'Ireland') {
        chart.options.scales.yAxes[0].ticks.max = 450;
        chart.options.scales.yAxes[0].ticks.stepSize = 45;
        chart.update();
      }

      document.getElementById('chartAF').onclick = function() {
        if (chart.options.scales.yAxes[0].ticks.max == Math.round(Math.max(...allValue) * 1.1) ){
          chart.options.scales.yAxes[0].ticks.max = 250;
          chart.options.scales.yAxes[0].ticks.stepSize = 25;
          chart.update()
        } else {
          chart.options.scales.yAxes[0].ticks.max = Math.round(Math.max(...allValue) * 1.1);
          chart.options.scales.yAxes[0].ticks.stepSize = Math.round(Math.max(...allValue) * 1.1)/10;
          chart.update()
      }
      high.style.display = "none";
      }

      if (document.getElementById('zoom').value = 'zoom -') {
        document.getElementById('zoom').innerHTML = 'zoom +';
      }

      document.getElementById('zoom').onclick = function() {
        high.style.display = "none";
        if (document.getElementById('zoom').value = 'zoom -') {
          document.getElementById('zoom').innerHTML = 'zoom +';
        }
        if (chart.options.scales.yAxes[0].ticks.max == Math.round(Math.max(...allValue) * 1.1) ){
          chart.options.scales.yAxes[0].ticks.max = 250;
          chart.options.scales.yAxes[0].ticks.stepSize = 25;
          chart.update()
          document.getElementById('zoom').innerHTML + 'zoom +';
        } else {
          chart.options.scales.yAxes[0].ticks.max = Math.round(Math.max(...allValue) * 1.1);
          chart.options.scales.yAxes[0].ticks.stepSize = Math.round(Math.max(...allValue)  * 1.1)/10;
          chart.update()
          document.getElementById('zoom').innerHTML = 'zoom -';
      }

      }
      notification1.classList.remove(activeClass)
      notification2.classList.remove(activeClass)
      notification3.classList.remove(activeClass)
      notification4.classList.remove(activeClass)
      notification5.classList.remove(activeClass)
      notification6.classList.remove(activeClass)
      notification7.classList.remove(activeClass)
      notification8.classList.remove(activeClass)

      high.style.display = "none"

      document.getElementById('zoominButton').style.display = "none"
      document.getElementById('zoomoutButton').style.display = "none"

    }


  //__________________________________________ LISTA PAESI ________________________

  document.getElementById("AF").onclick = function () {
    paginaPopup(33.93911, 67.709953, 'Afghanistan',
    [0.54, 0.08, 0.16, 0.16, 0.18, 0.20, 0.21, 0.27, 0.30, 0.37, 0.45, 0.49, 0.52, 0.50, 0.43, 0.35, 0.32, 0.69, 0.35],
    [26364, 26782, 23589, 26867, 25438, 27381, 30212, 32115, 23830, 30147, 31447, 32062, 34518, 35570, 42352, 48126, 52810, 26380, 51624],
    [0.54, 0.08, 0.16, 0.16, 0.18, 0.20, 0.21, 0.27, 0.30, 0.37, 0.45, 0.49, 0.52, 0.50, 0.43, 0.35, 0.32, 0.69, 0.36],
    [26364, 26782, 23589, 26867, 25438, 27381, 30212, 32115, 23830, 30147, 31447, 32062, 34518, 35570, 42352, 48126, 52810, 26380, 49435],

    30)
  }

  document.getElementById("AL").onclick = function () {
    paginaPopup(41.153323, 21.168331, 'Albania',
    [2.39, 2.90, 3.39, 4.72, 5.68, 8.18, 9.56, 11.40, 13.16, 13.54, 12.75, 14.11, 13.27, 14.12, 14.65, 12.80, 13.46, 14.86, 6.80],
    [1397, 1300, 1219, 1136, 1201, 929, 873, 866, 897, 810, 848, 826, 839, 820, 822, 814, 811, 809, 2008],
    [2.39, 2.90, 3.39, 4.72, 5.68, 8.18, 9.56, 11.40, 13.16, 13.54, 12.75, 14.11, 13.27, 14.12, 14.65, 12.80, 13.46, 14.86, 16.38],
    [1397, 1300, 1219, 1136, 1201, 929, 873, 866, 897, 810, 848, 826, 839, 820, 822, 814, 811, 809, 834],
    69)
  }

  document.getElementById("DZ").onclick = function () {
    paginaPopup(28.033886,1.659626,'Algeria',
    [2.57, 2.63, 2.83, 3.19, 4.71, 5.89, 6.72, 7.65, 9.91, 7.98, 15.89, 12.06, 12.74, 12.80, 12.98, 10.14, 9.93, 10.81, 6.16],
    [19394, 18967, 18261, 19378, 16464, 15926, 15828, 16035, 15681, 15627, 15067,  15048, 14883, 14851, 14923, 14816, 14494, 14258, 21449],
    [2.57, 2.63, 2.83, 3.19, 4.71, 5.89, 6.72, 7.65, 9.91, 7.98, 15.89, 12.06, 12.74, 12.80, 12.98, 10.14, 9.93, 10.81, 7.06],
    [19394, 18967, 18261, 19378, 16464, 15926, 15828, 16035, 15681, 15627, 15067,  15048, 14883, 14851, 14923, 14816, 14494, 14258, 18698],
    12)
  }
  document.getElementById("AD").onclick = function () {
    paginaPopup(42.546245, 1.601554, 'Andorra',
    [59.42, 62.18, 70.00, 85.94, 97.92, 106.01, 109.02, 122.13, 133.08, 122.54, 113.20, 126.90, 123.85, 131.37, 131.57, 102.34, 116.09, 105.45, 22.72],
    [23, 22, 22, 24, 25, 25, 26, 26, 27, 27, 27, 25, 24, 24, 25, 25, 25, 25, 125],
    [59.42, 62.18, 70.00, 85.94, 97.92, 106.01, 109.02, 122.13, 133.08, 122.54, 113.20, 126.90, 123.85, 131.37, 131.57, 102.34, 116.09, 105.45, 69.23],
    [23, 22, 22, 24, 25, 25, 26, 26, 27, 27, 27, 25, 24, 24, 25, 25, 25, 25, 41],
    186)
  }
  document.getElementById("AO").onclick = function () {
    paginaPopup(-11.202692,17.873667, 'Angola',
    [0.36, 0.36, 0.57, 0.67, 0.87, 1.27, 1.88, 2.72, 3.85, 3.54, 3.92, 5.00, 5.56, 6.19, 6.47, 5.23, 4.95, 6.48, 3.24],
    [20988, 20797, 18232, 17794, 18892, 18571, 18531, 18495, 18163, 17663, 17415, 17176, 16846, 16552, 16036, 16033, 15722, 15619, 17513],
    [0.36, 0.36, 0.57, 0.67, 0.87, 1.27, 1.88, 2.72, 3.85, 3.54, 3.92, 5.00, 5.56, 6.19, 6.47, 5.23, 4.95, 6.48, 3.31],
    [20988, 20797, 18232, 17794, 18892, 18571, 18531, 18495, 18163, 17663, 17415, 17176, 16846, 16552, 16036, 16033, 15722, 15619, 17114],
    47)
  }
  document.getElementById("AG").onclick = function () {
    paginaPopup(17.060816, -61.796428, 'Antigua & Barbuda',
    [23.15, 22.55, 22.18, 23.28, 24.21, 26.89, 29.49, 33.40, 36.63, 33.76, 28.43, 28.15, 30.74, 30.26, 32.45, 34.58, 36.98, 37.66, 32.73],
    [30, 30, 31, 31, 32, 32, 33, 33, 34, 33, 34, 34, 33, 33, 33, 33, 33, 34, 39],
    [23.15, 22.55, 22.18, 23.28, 24.21, 26.89, 29.49, 33.40, 36.63, 33.76, 28.43, 28.15, 30.74, 30.26, 32.45, 34.58, 36.98, 37.66, 37.49],
    [30, 30, 31, 31, 32, 32, 33, 33, 34, 33, 34, 34, 33, 33, 33, 33, 33, 34, 34],
    190)
  }
  document.getElementById("SA").onclick = function () {
    paginaPopup(23.885942,45.079162, 'Saudi Arabia',
    [14.50, 13.91, 13.71, 15.09, 18.07, 22.54, 24.49, 26.82, 32.86, 25.97, 27.22, 33.06, 34.54, 33.30, 32.26, 23.93, 26.75, 23.68, 15.66],
    [12611, 12867,  13509, 14014, 14467, 14657, 15393, 15428, 15618,  16177, 16570, 17099, 17691, 18359, 18955, 22204, 21861,  22798, 40696],
    [14.50, 13.91, 13.71, 15.09, 18.07, 22.54, 24.49, 26.82, 32.86, 25.97, 27.22, 33.06, 34.54, 33.30, 32.26, 23.93, 26.75, 23.68, 18.48],
    [12611, 12867,  13509, 14014, 14467, 14657, 15393, 15428, 15618,  16177, 16570, 17099, 17691, 18359, 18955, 22204, 21861,  22798, 34482],
    90)
  }
  document.getElementById("AR").onclick = function () {
    paginaPopup(-38.416097, -63.616672, 'Argentina',
    [12.10, 11.29, 3.99, 5.40, 7.29, 8.78, 10.13, 12.00, 15.06, 13.78, 17.63, 21.62, 21.82, 21.67, 21.09, 24.12, 35.62, 25.61, 5.29],
    [21372, 21657, 21911, 21508, 20561, 20592, 20900, 21813, 21847, 21987, 21868, 22318, 22769, 23175, 22704, 22440, 22625, 22656, 65664],
    [12.10, 11.29, 3.99, 5.40, 7.29, 8.78, 10.13, 12.00, 15.06, 13.78, 17.63, 21.62, 21.82, 21.67, 21.09, 24.12, 35.62, 25.61, 15.33],
    [21372, 21657, 21911, 21508, 20561, 20592, 20900, 21813, 21847, 21987, 21868, 22318, 22769, 23175, 22704, 22440, 22625, 22656, 22646],
    76 )
  }
  document.getElementById("AM").onclick = function () {
    paginaPopup(40.069099,45.038189, 'Armenia',
    [1.25, 1.42, 1.66, 2.00, 2.60, 3.55, 4.58, 6.83, 8.47, 6.30, 1.03, 7.52, 8.17, 8.99, 9.46, 8.36, 8.01, 9.79, 2.92],
    [1395, 1362, 1311, 1283, 1263, 1272, 1288, 1249, 1281, 1283, 8429, 1266, 1223, 1164, 1155, 1189, 1240, 1109, 3935],
    [1.25, 1.42, 1.66, 2.00, 2.60, 3.55, 4.58, 6.83, 8.47, 6.30, 1.03, 7.52, 8.17, 8.99, 9.46, 8.36, 8.01, 9.79, 10.15],
    [1395, 1362, 1311, 1283, 1263, 1272, 1288, 1249, 1281, 1283, 8429, 1266, 1223, 1164, 1155, 1189, 1240, 1109, 1133],
    115)
  }
  document.getElementById("AU").onclick = function () {
    paginaPopup(-25.274398, 133.775136, 'Australia',
    [46.10, 46.15, 47.08, 56.58, 74.12, 83.42, 88.74, 98.50, 118.07, 99.44, 124.27, 148.46, 164.87, 162.80, 145.98, 129.04, 114.77, 123.05, 112.14],
    [8173, 7417, 7571, 7439, 7460, 7511, 7611, 7927, 8159, 8509, 8429, 8624, 8582, 8727, 9178, 9561, 9617, 9804, 10721],
    [46.10, 46.15, 47.08, 56.58, 74.12, 83.42, 88.74, 98.50, 118.07, 99.44, 124.27, 148.46, 164.87, 162.80, 145.98, 129.04, 114.77, 123.05, 122.53],
    [8173, 7417, 7571, 7439, 7460, 7511, 7611, 7927, 8159, 8509, 8429, 8624, 8582, 8727, 9178, 9561, 9617, 9804, 9812],
    51)
  }
  document.getElementById("AT").onclick = function () {
    paginaPopup(47.516231, 14.550072, 'Austria',
    [40.91, 42.68, 45.16, 56.12, 64.14, 66.37, 72.81, 83.94, 92.97, 85.01, 82.99, 93.48, 87.83, 92.62, 93.98, 82.21, 83.29, 88.87, 36.93],
    [4399, 4227, 4317, 4261, 4282, 4336, 4200, 4217, 4217, 4293, 4312, 4213, 4255, 4229, 4264, 4181, 4188, 4161, 10675],
    [40.91, 42.68, 45.16, 56.12, 64.14, 66.37, 72.81, 83.94, 92.97, 85.01, 82.99, 93.48, 87.83, 92.62, 93.98, 82.21, 83.29, 88.87, 91.31],
    [4399, 4227, 4317, 4261, 4282, 4336, 4200, 4217, 4217, 4293, 4312, 4213, 4255, 4229, 4264, 4181, 4188, 4161, 4318],
    35)
  }
  document.getElementById("AZ").onclick = function () {
    paginaPopup(40.143105, 47.576927, 'Azerbaijan',
    [1.60, 1.84, 1.82, 2.35, 2.77, 4.05, 6.57, 13.56, 14.81, 13.36, 15.64, 19.28, 20.34, 21.67, 21.80, 15.24, 10.83, 12.10, 6.83],
    [3022, 2848, 3168, 2861, 2911, 3040, 2969, 2265, 3038, 3028, 3093, 3131, 3139, 3141, 3172, 3204, 3218, 3098, 5697],
    [1.60, 1.84, 1.82, 2.35, 2.77, 4.05, 6.57, 13.56, 14.81, 13.36, 15.64, 19.28, 20.34, 21.67, 21.80, 15.24, 10.83, 12.10, 12.46],
    [3022, 2848, 3168, 2861, 2911, 3040, 2969, 2265, 3038, 3028, 3093, 3131, 3139, 3141, 3172, 3204, 3218, 3098, 3122],
    106)
  }
  document.getElementById("BS").onclick = function () {
    paginaPopup(25.03428,-77.39628, 'Bahamas',
    [37.66, 37.66, 38.67, 41.61, 39.43, 43.24, 43.03, 43.13, 41.10, 37.38, 39.43, 35.40, 36.30, 35.10, 36.61, 35.29, 39.76, 40.87, 19.84],
    [217, 201, 209, 194, 209, 207, 215, 224, 233, 243, 233, 259, 269, 276, 273, 305, 272, 272, 516],
    [37.66, 37.66, 38.67, 41.61, 39.43, 43.24, 43.03, 43.13, 41.10, 37.38, 39.43, 35.40, 36.30, 35.10, 36.61, 35.29, 39.76, 40.87, 29.58],
    [217, 201, 209, 194, 209, 207, 215, 224, 233, 243, 233, 259, 269, 276, 273, 305, 272, 272, 346],
    161)
  }
  document.getElementById("BRN").onclick = function () {
    paginaPopup(25.930414, 50.637772, 'Bahrain',
    [21.11, 32.68, 35.01, 38.81, 42.22, 48.69, 45.54, 87.09, 77.30, 69.34, 78.76, 83.09, 92.58, 97.36, 101.85, 93.54, 95.27, 96.05, 51.04],
    [392, 249, 247, 254, 276, 291, 363, 225, 303, 304, 302, 322, 310, 312, 304, 304, 301, 318, 737],
    [21.11, 32.68, 35.01, 38.81, 42.22, 48.69, 45.54, 87.09, 77.30, 69.34, 78.76, 83.09, 92.58, 97.36, 101.85, 93.54, 95.27, 96.05, 97.70],
    [392, 249, 247, 254, 276, 291, 363, 225, 303, 304, 302, 322, 310, 312, 304, 304, 301, 318, 385],
    1)
  }
  document.getElementById("BD").onclick = function () {
    paginaPopup(23.684994, 90.356331, 'Bangladesh',
    [0.62, 0.63, 0.65, 0.71, 0.77, 0.83, 0.88, 0.90, 1.12, 1.30, 1.49, 1.74, 1.88, 2.17, 2.57, 2.96, 3.45, 3.93, 5.82],
    [78418, 77507, 76647, 76856, 76481, 76151, 73945, 80287, 74038, 71697, 70043, 67004, 64261, 62714, 61127, 59990, 58308, 57812, 50656],
    [0.62, 0.63, 0.65, 0.71, 0.77, 0.83, 0.88, 0.90, 1.12, 1.30, 1.49, 1.74, 1.88, 2.17, 2.57, 2.96, 3.45, 3.93, 6.85],
    [78418, 77507, 76647, 76856, 76481, 76151, 73945, 80287, 74038, 71697, 70043, 67004, 64261, 62714, 61127, 59990, 58308, 57812, 43097],
    31)
  }
  document.getElementById("BB").onclick = function () {
    paginaPopup(13.193887, -59.543198, 'Barbados',
    [23.39, 23.83, 23.64, 23.84, 25.18, 27.71, 30.19, 32.41, 33.01, 32.02, 32.22, 33.40, 33.90, 33.05, 32.76, 32.34, 31.46, 33.07, 27.87],
    [121, 119, 122, 125, 127, 128, 128, 127, 127, 126, 126, 127, 125, 127, 128, 129, 131, 132, 143],
    [23.39, 23.83, 23.64, 23.84, 25.18, 27.71, 30.19, 32.41, 33.01, 32.02, 32.22, 33.40, 33.90, 33.05, 32.76, 32.34, 31.46, 33.07, 29.31],
    [121, 119, 122, 125, 127, 128, 128, 127, 127, 126, 126, 127, 125, 127, 128, 129, 131, 132, 136],
    191)
  }
  document.getElementById("BY").onclick = function () {
    paginaPopup(53.709807, 27.953389, 'Belarus',
    [0.84, 0.79, 0.91, 1.17, 1.57, 1.98, 2.62, 3.31, 4.41, 3.64, 4.28, 4.62, 5.99, 7.37, 8.06, 6.19, 5.46, 6.20, 5.75],
    [14329, 14881, 15332, 14640, 14258, 14780, 13733, 12656, 12739, 12488, 12310, 12310, 10176, 9481, 8902, 8299, 8015, 8037, 9590],
    [0.84, 0.79, 0.91, 1.17, 1.57, 1.98, 2.62, 3.31, 4.41, 3.64, 4.28, 4.62, 5.99, 7.37, 8.06, 6.19, 5.46, 6.20, 6.74],
    [14329, 14881, 15332, 14640, 14258, 14780, 13733, 12656, 12739, 12488, 12310, 12310, 10176, 9481, 8902, 8299, 8015, 8037, 8176],
    5)
  }
  document.getElementById("BE").onclick = function () {
    paginaPopup(50.503887, 4.469936, 'Belgium',
    [30.39, 30.25, 33.28, 41.43, 49.89, 55.00, 55.33, 62.49, 67.19, 62.42, 62.15, 65.89, 61.41, 64.72, 68.02, 57.23, 58.89, 63.89, 17.25],
    [7135, 7138, 7100, 7040, 6811, 6460, 6794, 6922, 7070, 7102, 7102, 7250, 7346, 7305, 7112, 7251, 7134, 7062, 27267],
    [30.39, 30.25, 33.28, 41.43, 49.89, 55.00, 55.33, 62.49, 67.19, 62.42, 62.15, 65.89, 61.41, 64.72, 68.02, 57.23, 58.89, 63.89, 61.61],
    [7135, 7138, 7100, 7040, 6811, 6460, 6794, 6922, 7070, 7102, 7102, 7250, 7346, 7305, 7112, 7251, 7134, 7062, 7634],
    100)
  }
  document.getElementById("BZ").onclick = function () {
    paginaPopup(17.189877, -88.49765, 'Belize',
    [3.40, 3.43, 4.14, 4.33, 4.54, 4.51, 4.99, 5.17, 5.17, 5.03, 4.95, 5.16, 5.36, 5.38, 5.62, 5.64, 5.77, 5.47, 2.87],
    [223, 231, 205, 208, 212, 225, 222, 227, 241, 242, 257, 262, 267, 273, 276, 287, 299, 306, 562],
    [3.40, 3.43, 4.14, 4.33, 4.54, 4.51, 4.99, 5.17, 5.17, 5.03, 4.95, 5.16, 5.36, 5.38, 5.62, 5.64, 5.77, 5.47, 5.00],
    [223, 231, 205, 208, 212, 225, 222, 227, 241, 242, 257, 262, 267, 273, 276, 287, 299, 306, 321],
    23)
  }
  document.getElementById("BJ").onclick = function () {
    paginaPopup(9.30769, 2.315834, 'Benin',
    [0.41, 0.43, 0.48, 0.60, 0.71, 0.76, 0.81, 0.94, 1.11, 1.07, 1.03, 1.11, 1.10, 1.21, 1.28, 1.07, 1.12, 1.21, 2.24],
    [5722, 5773, 5931, 6068, 5941, 5872, 5946, 5938, 6045, 6215, 6365, 6632, 6971, 7123, 7134, 7240, 7165, 7139, 6371],
    [0.41, 0.43, 0.48, 0.60, 0.71, 0.76, 0.81, 0.94, 1.11, 1.07, 1.03, 1.11, 1.10, 1.21, 1.28, 1.07, 1.12, 1.21, 2.25],
    [5722, 5773, 5931, 6068, 5941, 5872, 5946, 5938, 6045, 6215, 6365, 6632, 6971, 7123, 7134, 7240, 7165, 7139, 6327],
    143);
  }

  document.getElementById("BT").onclick = function () {
    paginaPopup(27.514162, 90.433601, 'Bhutan',
    [0.73, 1.27, 1.45, 1.69, 1.93, 2.25, 2.47, 3.26, 3.38, 3.14, 4.15, 4.67, 4.64, 4.52, 4.83, 5.15, 5.42, 6.11, 6.44],
    [539, 336, 333, 331, 328, 328, 331, 331, 339, 363, 344, 351, 353, 357, 361, 364, 365, 367, 341],
    [0.73, 1.27, 1.45, 1.69, 1.93, 2.25, 2.47, 3.26, 3.38, 3.14, 4.15, 4.67, 4.64, 4.52, 4.83, 5.15, 5.42, 6.11, 6.44],
    [539, 336, 333, 331, 328, 328, 331, 331, 339, 363, 344, 351, 353, 357, 361, 364, 365, 367, 341],
    156)
  }
  document.getElementById("MM").onclick = function () {
    paginaPopup(21.913965, 95.956223, 'Myanmar',
    [0.21, 0.16, 0.17, 0.26, 0.26, 0.27, 0.37, 0.53, 0.17, 1.01, 1.39, 1.67, 1.68, 1.73, 1.93, 1.72, 1.88, 1.72, 2.43],
    [39780, 38993, 38413, 37355, 37819, 41326, 36533, 35971, 173199, 34372, 33533, 33776, 33389, 32579, 31787, 32509, 31492, 37700, 28525],
    [0.21, 0.16, 0.17, 0.26, 0.26, 0.27, 0.37, 0.53, 0.17, 1.01, 1.39, 1.67, 1.68, 1.73, 1.93, 1.72, 1.88, 1.72, 2.68],
    [39780, 38993, 38413, 37355, 37819, 41326, 36533, 35971, 173199, 34372, 33533, 33776, 33389, 32579, 31787, 32509, 31492, 37700, 25843],
    62)
  }
  document.getElementById("BO").onclick = function () {
    paginaPopup(-16.290154, -63.588653, 'Bolivia',
    [1.10, 1.10, 1.07, 1.11, 1.23, 1.39, 1.65, 1.90, 2.41, 2.55, 2.85, 3.47, 3.97, 4.44, 4.74, 4.85, 5.00, 5.52, 2.12],
    [6934, 6724, 6754, 6641, 6469, 6271, 6330, 6299, 6309, 6196, 6266, 6289, 6208, 6285, 6328, 6187, 6175, 6187, 15766],
    [1.10, 1.10, 1.07, 1.11, 1.23, 1.39, 1.65, 1.90, 2.41, 2.55, 2.85, 3.47, 3.97, 4.44, 4.74, 4.85, 5.00, 5.52, 5.03],
    [6934, 6724, 6754, 6641, 6469, 6271, 6330, 6299, 6309, 6196, 6266, 6289, 6208, 6285, 6328, 6187, 6175, 6187, 6631],
    10)
  }
  document.getElementById("BA").onclick = function () {
    paginaPopup(43.915886, 17.679076, 'Bosnia and Herzegovina',
    [3.54, 3.92, 4.58, 5.89, 7.19, 7.88, 9.25, 10.92, 12.77, 13.28, 13.37, 14.99, 14.13, 14.93, 14.97, 9.14, 14.31, 15.63, 3.43],
    [1425, 1343, 1332, 1307, 1283, 1314, 1285, 1338, 1286, 1236, 1205, 1176, 1164, 1175, 1208, 1183, 1163, 1144, 5254],
    [3.54, 3.92, 4.58, 5.89, 7.19, 7.88, 9.25, 10.92, 12.77, 13.28, 13.37, 14.99, 14.13, 14.93, 14.97, 9.14, 14.31, 15.63, 14.96],
    [1425, 1343, 1332, 1307, 1283, 1314, 1285, 1338, 1286, 1236, 1205, 1176, 1164, 1175, 1208, 1183, 1163, 1144, 1204],
    94)
  }
  document.getElementById("BW").onclick = function () {
    paginaPopup(-22.328474, 24.684866, 'Botswana',
    [6.10, 5.55, 5.28, 7.13, 8.39, 9.36, 9.65, 10.91, 10.80, 10.07, 13.51, 15.11, 14.14, 14.08, 15.32, 13.49, 14.68, 16.20, 6.91],
    [867, 903, 941, 962, 975, 970, 961, 920, 932, 941, 945, 962, 965, 986, 988, 996, 993, 1000, 2079],
    [6.10, 5.55, 5.28, 7.13, 8.39, 9.36, 9.65, 10.91, 10.80, 10.07, 13.51, 15.11, 14.14, 14.08, 15.32, 13.49, 14.68, 16.20, 7.04],
    [867, 903, 941, 962, 975, 970, 961, 920, 932, 941, 945, 962, 965, 986, 988, 996, 993, 1000, 2039],
    16)
  }
  document.getElementById("BR").onclick = function () {
    paginaPopup(-14.235004, -51.92528, 'Brazil',
    [4.13, 3.50, 3.13, 3.41, 4.10, 5.52, 6.82, 8.53, 10.21, 9.86, 12.82, 14.69, 13.91, 13.66, 13.46, 9.92, 9.88, 11.34, 3.64],
    [144779, 146147, 148563, 149748, 149803, 148154, 149152, 150336, 152530, 155315, 158277, 163578, 162712, 166269, 167505, 166806, 170001, 166429, 360965],
    [4.13, 3.50, 3.13, 3.41, 4.10, 5.52, 6.82, 8.53, 10.21, 9.86, 12.82, 14.69, 13.91, 13.66, 13.46, 9.92, 9.88, 11.34, 7.81],
    [144779, 146147, 148563, 149748, 149803, 148154, 149152, 150336, 152530, 155315, 158277, 163578, 162712, 166269, 167505, 166806, 170001, 166429, 168284],
    24)
  }
  document.getElementById("BN").onclick = function () {
    paginaPopup(4.535277, 114.727669, 'Brunei',
    [41.27, 38.31, 39.88, 44.72, 53.46, 63.21, 75.10, 78.96, 91.96, 66.44, 83.16, 111.70, 112.00, 103.73, 96.78, 70.99, 62.58, 64.28, 68.85],
    [131, 132, 132, 132, 134, 136, 139, 141, 143, 147, 150, 153, 157, 161, 163, 168, 168, 174, 159],
    [41.27, 38.31, 39.88, 44.72, 53.46, 63.21, 75.10, 78.96, 91.96, 66.44, 83.16, 111.70, 112.00, 103.73, 96.78, 70.99, 62.58, 64.28, 70.18],
    [131, 132, 132, 132, 134, 136, 139, 141, 143, 147, 150, 153, 157, 161, 163, 168, 168, 174, 156],
    170)
  }
  document.getElementById("BG").onclick = function () {
    paginaPopup(42.733883, 25.48583, 'Bulgaria',
    [2.25, 2.57, 3.14, 4.20, 5.30, 6.10, 7.13, 9.58, 12.07, 12.08, 12.35, 14.58, 13.76, 14.98, 17.48, 13.55, 14.41, 15.42, 5.73],
    [5199, 4947, 4730, 4567, 4468, 4437, 4371, 4231, 4112, 3918, 3735, 3588, 3563, 3381, 2945, 3358, 3349, 3340, 11012],
    [2.25, 2.57, 3.14, 4.20, 5.30, 6.10, 7.13, 9.58, 12.07, 12.08, 12.35, 14.58, 13.76, 14.98, 17.48, 13.55, 14.41, 15.42, 18.04],
    [5199, 4947, 4730, 4567, 4468, 4437, 4371, 4231, 4112, 3918, 3735, 3588, 3563, 3381, 2945, 3358, 3349, 3340, 3497],
    103)
  }
  document.getElementById("BF").onclick = function () {
    paginaPopup(12.238333,-1.561593, 'Burkina Faso',
    [0.27, 0.29, 0.32, 0.42, 0.48, 0.54, 0.56, 0.64, 0.77, 0.76, 0.79, 0.91, 0.89, 0.92, 0.91, 0.74, 0.78, 0.87, 0.97],
    [8865, 8912, 9125, 9106, 9214, 9173, 9492, 9567, 9853, 10015, 10419, 10741, 11438, 11847, 12322, 12766, 13316, 13376, 16329],
    [0.27, 0.29, 0.32, 0.42, 0.48, 0.54, 0.56, 0.64, 0.77, 0.76, 0.79, 0.91, 0.89, 0.92, 0.91, 0.74, 0.78, 0.87, 0.97],
    [8865, 8912, 9125, 9106, 9214, 9173, 9492, 9567, 9853, 10015, 10419, 10741, 11438, 11847, 12322, 12766, 13316, 13376, 16247],
    2)
  }
  document.getElementById("BI").onclick = function () {
    paginaPopup(-3.373056, 29.918886, 'Burundi',
    [0.05, 0.05, 0.05, 0.04, 0.05, 0.06, 0.26, 0.28, 0.32, 0.36, 0.40, 0.45, 0.49, 0.52, 0.58, 0.51, 0.53, 0.62, 0.54],
    [18524, 17970, 17516, 17725, 17170, 17415, 4760, 4655, 4866, 4783, 4991, 5107, 5031, 5154, 5343, 6037, 5685, 5603, 5519],
    [0.05, 0.05, 0.05, 0.04, 0.05, 0.06, 0.26, 0.28, 0.32, 0.36, 0.40, 0.45, 0.49, 0.52, 0.58, 0.51, 0.53, 0.62, 0.54],
    [18524, 17970, 17516, 17725, 17170, 17415, 4760, 4655, 4866, 4783, 4991, 5107, 5031, 5154, 5343, 6037, 5685, 5603, 5517],
    104)
  }
  document.getElementById("KH").onclick = function () {
    paginaPopup(12.565679, 104.990963, 'Cambodia',
    [0.25, 0.28, 0.31, 0.34, 0.39, 0.47, 0.54, 0.65, 0.78, 0.77, 0.81, 0.93, 1.03, 1.09, 1.20, 1.30, 1.43, 1.59, 2.64],
    [13347, 12883, 12786, 12585, 12422, 12227, 12208, 12231, 12197, 12304, 12694, 12658, 12518, 12736, 12689, 12720, 12761, 12772, 8717],
    [0.25, 0.28, 0.31, 0.34, 0.39, 0.47, 0.54, 0.65, 0.78, 0.77, 0.81, 0.93, 1.03, 1.09, 1.20, 1.30, 1.43, 1.59, 2.64],
    [13347, 12883, 12786, 12585, 12422, 12227, 12208, 12231, 12197, 12304, 12694, 12658, 12518, 12736, 12689, 12720, 12761, 12772, 8717],
    123)
  }
  document.getElementById("CM").onclick = function () {
    paginaPopup(7.369722, 12.354722, 'Cameroon',
    [0.97, 0.99, 1.07, 1.31, 1.57, 1.56, 1.61, 1.81, 2.06, 1.98, 1.92, 2.12, 2.10, 2.34, 2.32, 1.97, 2.16, 2.37, 2.24],
    [9879, 9956, 10265, 10538, 10551, 10867, 11371, 11644, 12091, 12366, 12778, 12946, 12942, 12906, 14018, 14601, 13851, 13617, 16174],
    [0.97, 0.99, 1.07, 1.31, 1.57, 1.56, 1.61, 1.81, 2.06, 1.98, 1.92, 2.12, 2.10, 2.34, 2.32, 1.97, 2.16, 2.37, 2.30],
    [9879, 9956, 10265, 10538, 10551, 10867, 11371, 11644, 12091, 12366, 12778, 12946, 12942, 12906, 14018, 14601, 13851, 13617, 15726],
    14)
  }
  document.getElementById("CA").onclick = function () {
    paginaPopup(56.130366, -106.346771, 'Canada',
    [50.87, 49.08, 49.74, 57.44, 65.81, 72.07, 82.53, 89.43, 91.58, 80.07, 95.89, 103.48, 105.39, 105.89, 100.41, 85.07, 83.64, 89.24, 45.76],
    [13249, 13614, 13835, 14101, 14115, 14739, 14523, 14949, 15447, 15637, 15367, 15802, 15806, 15870, 16331, 16734, 16719, 16818, 32458],
    [50.87, 49.08, 49.74, 57.44, 65.81, 72.07, 82.53, 89.43, 91.58, 80.07, 95.89, 103.48, 105.39, 105.89, 100.41, 85.07, 83.64, 89.24, 86.95],
    [13249, 13614, 13835, 14101, 14115, 14739, 14523, 14949, 15447, 15637, 15367, 15802, 15806, 15870, 16331, 16734, 16719, 16818, 17080],
    97)
  }
  document.getElementById("CV").onclick = function () {
    paginaPopup(16.002082, -24.013197, 'Cabo Verde',
    [2.66, 1.81, 2.23, 2.85, 3.21, 3.35, 3.73, 4.30, 6.13, 5.52, 5.93, 6.22, 6.56, 6.94, 5.56, 7.53, 10.68, 11.10, 3.38],
    [254, 257, 260, 261, 262, 263, 268, 325, 272, 280, 285, 289, 291, 292, 296, 321, 300, 301, 458],
    [2.66, 1.81, 2.23, 2.85, 3.21, 3.35, 3.73, 4.30, 6.13, 5.52, 5.93, 6.22, 6.56, 6.94, 5.56, 7.53, 10.68, 11.10, 4.48],
    [254, 257, 260, 261, 262, 263, 268, 325, 272, 280, 285, 289, 291, 292, 296, 321, 300, 301, 346],
    172)
  }
  document.getElementById("TD").onclick = function () {
    paginaPopup(15.454166, 18.732207, 'Chad',
    [0.18, 0.23, 0.04, 0.37, 0.56, 0.81, 0.67, 0.90, 1.08, 1.06, 1.19, 1.35, 1.35, 1.38, 1.47, 1.06, 0.95, 0.96, 0.97],
    [7135, 6666, 6785, 6789, 7107, 7463, 10055, 8720, 8735, 7958, 8127, 8206, 8341, 8519, 8632, 9465, 9063, 9447, 9512],
    [0.18, 0.23, 0.04, 0.37, 0.56, 0.81, 0.67, 0.90, 1.08, 1.06, 1.19, 1.35, 1.35, 1.38, 1.47, 1.06, 0.95, 0.96, 0.98],
    [7135, 6666, 6785, 6789, 7107, 7463, 10055, 8720, 8735, 7958, 8127, 8206, 8341, 8519, 8632, 9465, 9063, 9447, 9408],
    68)
  }
  document.getElementById("CL").onclick = function () {
    paginaPopup(-35.675147,	-71.542969, 'Chile',
    [17.93, 18.24, 19.27, 19.08, 20.58, 23.12, 23.91, 28.23, 28.27, 27.55, 28.36, 33.84, 39.03, 40.00, 46.41, 48.44, 48.13, 49.09, 9.29],
    [7754, 7623, 7319, 7407, 7508, 7518, 7847, 7567, 7961, 8151, 8386, 8027, 7561, 7616, 7746, 7868, 8206, 8328, 24774],
    [17.93, 18.24, 19.27, 19.08, 20.58, 23.12, 23.91, 28.23, 28.27, 27.55, 28.36, 33.84, 39.03, 40.00, 46.41, 48.44, 48.13, 49.09, 27.82],
    [7754, 7623, 7319, 7407, 7508, 7518, 7847, 7567, 7961, 8151, 8386, 8027, 7561, 7616, 7746, 7868, 8206, 8328, 8275],
    128)
  }
  document.getElementById("CN").onclick = function () {
    paginaPopup(35.8616,104.195397,'China',
    [1.27, 1.49, 1.70, 1.95, 2.24, 2.62, 3.25, 4.25, 4.91, 6.03, 7.16, 9.13, 10.44, 11.81, 12.74, 13.38, 13.59, 15.16, 19.34],
    [871052, 818589, 786931, 773767, 795094, 793373, 769310, 760310, 852011, 771016, 775531, 755364, 746424, 740827, 749564, 753034, 749434, 733517, 711213],
    [1.27, 1.49, 1.70, 1.95, 2.24, 2.62, 3.25, 4.25, 4.91, 6.03, 7.16, 9.13, 10.44, 11.81, 12.74, 13.38, 13.59, 15.16, 19.47],
    [871052, 818589, 786931, 773767, 795094, 793373, 769310, 760310, 852011, 771016, 775531, 755364, 746424, 740827, 749564, 753034, 749434, 733517, 706425],
    96)
  }
  document.getElementById("CY").onclick = function () {
    paginaPopup(35.126413,33.429859, 'Cyprus',
    [24.68, 26.23, 29.24, 36.99, 44.21, 45.81, 54.76, 65.26, 77.73, 72.38, 72.29, 76.14, 110.02, 69.93, 68.30, 57.62, 58.36, 61.39, 44.22],
    [509, 501, 498, 497, 499, 518, 472, 464, 445, 439, 427, 429, 270, 414, 420, 426, 433, 443, 662],
    [24.68, 26.23, 29.24, 36.99, 44.21, 45.81, 54.76, 65.26, 77.73, 72.38, 72.29, 76.14, 110.02, 69.93, 68.30, 57.62, 58.36, 61.39, 53.92],
    [509, 501, 498, 497, 499, 518, 472, 464, 445, 439, 427, 429, 270, 414, 420, 426, 433, 443, 543],
    167)
  }
  document.getElementById("CO").onclick = function () {
    paginaPopup(4.570868, -74.297333, 'Colombia',
    [4.95, 4.89, 5.08, 6.12, 6.66, 8.99, 9.97, 9.18, 10.83, 10.84, 12.16, 13.99, 15.22, 16.16, 18.86, 21.13, 20.07, 20.44, 3.27],
    [45945, 47109, 48320, 39366, 38438, 34518, 34321, 32469, 33117, 35361, 33597, 31308, 30746, 29512, 28060, 28166, 31018, 31595, 75473],
    [4.95, 4.89, 5.08, 6.12, 6.66, 8.99, 9.97, 9.18, 10.83, 10.84, 12.16, 13.99, 15.22, 16.16, 18.86, 21.13, 20.07, 20.44, 7.52],
    [45945, 47109, 48320, 39366, 38438, 34518, 34321, 32469, 33117, 35361, 33597, 31308, 30746, 29512, 28060, 28166, 31018, 31595, 32853],
    45)
  }
  document.getElementById("KM").onclick = function () {
    paginaPopup(-11.875001, 43.872219, 'Comoros',
    [0.59, 0.65, 0.70, 0.96, 1.08, 1.03, 1.03, 1.06, 1.46, 0.93, 1.46, 1.17, 1.38, 1.52, 1.74, 1.51, 1.64, 1.73, 2.63],
    [314, 309, 324, 305, 314, 340, 362, 399, 330, 517, 335, 459, 381, 374, 343, 345, 347, 351, 423],
    [0.59, 0.65, 0.70, 0.96, 1.08, 1.03, 1.03, 1.06, 1.46, 0.93, 1.46, 1.17, 1.38, 1.52, 1.74, 1.51, 1.64, 1.73, 2.68],
    [314, 309, 324, 305, 314, 340, 362, 399, 330, 517, 335, 459, 381, 374, 343, 345, 347, 351, 414],
    176)
  }
  document.getElementById("KP").onclick = function () {
    paginaPopup(40.339852, 127.510093, 'Korea, North',
    [0.75, 0.64, 0.66, 0.66, 0.65, 0.74, 0.77, 0.78, 0.75, 0.67, 0.78, 0.87, 0.87, 0.92, 0.97, 0.91, 0.90, 0.96, 0.79],
    [14164, 14672, 14927, 15275, 15714, 15924, 16144, 16765, 16198, 16290, 16369, 16432, 16554, 16440, 16321, 16351, 16886, 16541, 19048],
    [0.75, 0.64, 0.66, 0.66, 0.65, 0.74, 0.77, 0.78, 0.75, 0.67, 0.78, 0.87, 0.87, 0.92, 0.97, 0.91, 0.90, 0.96, 0.79],
    [14164, 14672, 14927, 15275, 15714, 15924, 16144, 16765, 16198, 16290, 16369, 16432, 16554, 16440, 16321, 16351, 16886, 16541, 19048],
    139)
  }
  document.getElementById("KR").onclick = function () {
    paginaPopup(35.907757, 127.766922, 'Korea, South',
    [27.84, 17.08, 18.86, 19.29, 22.42, 26.09, 30.78, 33.48, 29.51, 24.81, 30.14, 33.24, 35.20, 37.76, 43.06, 42.98, 41.52, 44.18, 44.85],
    [17999, 28632, 28762, 31456, 30476, 30864, 29504, 30137, 30475, 32661, 32644, 32445, 31153, 31015, 29349, 28784, 30477, 30978, 32759],
    [27.84, 17.08, 18.86, 19.29, 22.42, 26.09, 30.78, 33.48, 29.51, 24.81, 30.14, 33.24, 35.20, 37.76, 43.06, 42.98, 41.52, 44.18, 46.11],
    [17999, 28632, 28762, 31456, 30476, 30864, 29504, 30137, 30475, 32661, 32644, 32445, 31153, 31015, 29349, 28784, 30477, 30978, 31859],
    124)
  }
  document.getElementById("CI").onclick = function () {
    paginaPopup(7.539989, -5.54708, "Ivory Coast",
    [0.79, 0.84, 0.84, 1.04, 1.15, 1.20, 1.23, 1.40, 1.69, 1.70, 1.71, 1.59, 1.76, 1.97, 2.17, 2.01, 2.21, 2.49, 4.43],
    [12262, 11848, 13189, 13197, 12971, 12799, 12964, 13007, 12842, 12812, 13006, 14290, 13767, 14201, 14543, 14722, 14630, 14428, 12626],
    [0.79, 0.84, 0.84, 1.04, 1.15, 1.20, 1.23, 1.40, 1.69, 1.70, 1.71, 1.59, 1.76, 1.97, 2.17, 2.01, 2.21, 2.49, 4.47],
    [12262, 11848, 13189, 13197, 12971, 12799, 12964, 13007, 12842, 12812, 13006, 14290, 13767, 14201, 14543, 14722, 14630, 14428, 12489],
    11)
  }
  document.getElementById("CR").onclick = function () {
    paginaPopup(9.748917, -83.753428, 'Costa Rica',
    [13.14, 10.86, 16.93, 17.61, 18.40, 23.24, 22.77, 22.84, 22.30, 22.64, 20.63, 20.54, 25.51, 27.37, 27.76, 28.28, 28.38, 30.18, 11.70],
    [1817, 2680, 1851, 1935, 1983, 1891, 2147, 1927, 2073, 1979, 2259, 2460, 2119, 2013, 2193, 2361, 2501, 2537, 4785],
    [13.14, 10.86, 16.93, 17.61, 18.40, 23.24, 22.77, 22.84, 22.30, 22.64, 20.63, 20.54, 25.51, 27.37, 27.76, 28.28, 28.38, 30.18, 21.30],
    [1817, 2680, 1851, 1935, 1983, 1891, 2147, 1927, 2073, 1979, 2259, 2460, 2119, 2013, 2193, 2361, 2501, 2537, 2629],
    78)
  }
  document.getElementById("HR").onclick = function () {
    paginaPopup(45.1,15.2, 'Croatia',
    [8.02, 10.47, 12.97, 14.77, 15.53, 17.12, 19.30, 20.76, 23.77, 23.02, 22.97, 25.96, 23.86, 25.02, 27.39, 27.32, 30.52, 34.09, 7.74],
    [2905, 2742, 2707, 2859, 2870, 2878, 2753, 2953, 3035, 2987, 2968, 2767, 2951, 2758, 2750, 2888, 2834, 2701, 6674],
    [8.02, 10.47, 12.97, 14.77, 15.53, 17.12, 19.30, 20.76, 23.77, 23.02, 22.97, 25.96, 23.86, 25.02, 27.39, 27.32, 30.52, 34.09, 18.76],
    [2905, 2742, 2707, 2859, 2870, 2878, 2753, 2953, 3035, 2987, 2968, 2767, 2951, 2758, 2750, 2888, 2834, 2701, 2754],
    54)
  }
  document.getElementById("CG").onclick = function () {
    paginaPopup(-0.228021, 15.827659, 'Congo',
    [0.81, 0.85, 0.89, 1.07, 1.41, 1.81, 2.31, 2.45, 3.41, 2.72, 3.50, 4.38, 3.63, 4.12, 4.14, 2.51, 2.18, 2.49, 2.67],
    [3496, 2845, 2943, 2824, 2825, 2873, 2853, 2904, 2942, 2978, 2887, 2764, 3165, 2867, 2872, 2861, 3014, 2943, 3705],
    [0.81, 0.85, 0.89, 1.07, 1.41, 1.81, 2.31, 2.45, 3.41, 2.72, 3.50, 4.38, 3.63, 4.12, 4.14, 2.51, 2.18, 2.49, 3.28],
    [3496, 2845, 2943, 2824, 2825, 2873, 2853, 2904, 2942, 2978, 2887, 2764, 3165, 2867, 2872, 2861, 3014, 2943, 3021],
    110)
  }
  document.getElementById("CD").onclick = function () {
    paginaPopup(-4.038333, 21.758664, 'Congo RD',
    [0.42, 0.16, 0.17, 0.18, 0.23, 0.27, 0.32, 0.36, 0.39, 0.32, 0.42, 0.51, 0.55, 0.60, 0.67, 0.71, 0.66, 0.67, 0.81],
    [42268, 41887, 48849, 44888, 40798, 40652, 41400, 42944, 46860, 53646, 47397, 47250, 49219, 49941, 49726, 48886, 48749, 50895, 55962],
    [0.42, 0.16, 0.17, 0.18, 0.23, 0.27, 0.32, 0.36, 0.39, 0.32, 0.42, 0.51, 0.55, 0.60, 0.67, 0.71, 0.66, 0.67, 0.82],
    [42268, 41887, 48849, 44888, 40798, 40652, 41400, 42944, 46860, 53646, 47397, 47250, 49219, 49941, 49726, 48886, 48749, 50895, 55378],
    27)
  }
  document.getElementById("CU").onclick = function () {
    paginaPopup(21.521757, -77.781167, 'Cuba',
    [3.61, 3.92, 4.82, 4.79, 5.03, 5.48, 7.40, 8.23, 8.08, 7.85, 8.13, 8.91, 9.37, 9.23, 9.43, 9.91, 10.54, 10.66, 11.40],
    [7655, 7322, 6952, 6781, 6880, 7047, 6453, 6450, 6818, 7162, 7161, 7010, 7056, 7549, 7717, 7933, 7706, 7737, 8405],
    [3.61, 3.92, 4.82, 4.79, 5.03, 5.48, 7.40, 8.23, 8.08, 7.85, 8.13, 8.91, 9.37, 9.23, 9.43, 9.91, 10.54, 10.66, 11.60],
    [7655, 7322, 6952, 6781, 6880, 7047, 6453, 6450, 6818, 7162, 7161, 7010, 7056, 7549, 7717, 7933, 7706, 7737, 8260],
    42)
  }
  document.getElementById("DK").onclick = function () {
    paginaPopup(56.26392, 9.501785, 'Denmark',
    [36.81, 43.00, 54.43, 59.65, 64.79, 66.09, 68.37, 73.74, 75.89, 81.32, 89.55, 91.26, 93.06, 94.07, 157.21, 142.05, 123.97, 127.51, 89.61],
    [3356, 2468, 2596, 2547, 2435, 2589, 2672, 2503, 2438, 2213, 2059, 2160, 2092, 2051, 2039, 1920, 2232, 2289, 3583],
    [36.81, 43.00, 54.43, 59.65, 64.79, 66.09, 68.37, 73.74, 75.89, 81.32, 89.55, 91.26, 93.06, 94.07, 157.21, 142.05, 123.97, 127.51, 137.98],
    [3356, 2468, 2596, 2547, 2435, 2589, 2672, 2503, 2438, 2213, 2059, 2160, 2092, 2051, 2039, 1920, 2232, 2289, 2327],
    57)
  }
  document.getElementById("DM").onclick = function () {
    paginaPopup(15.414999, -61.370976, 'Dominica',
    [8.69, 8.88, 8.74, 8.57, 9.43, 9.32, 9.82, 9.31, 11.22, 11.66, 10.65, 11.35, 13.76, 10.11, 13.95, 14.26, 10.33, 12.43, 10.41],
    [35, 35, 35, 37, 36, 36, 36, 41, 37, 38, 42, 40, 32, 45, 34, 34, 51, 41, 41],
    [8.69, 8.88, 8.74, 8.57, 9.43, 9.32, 9.82, 9.31, 11.22, 11.66, 10.65, 11.35, 13.76, 10.11, 13.95, 14.26, 10.33, 12.43, 10.41],
    [35, 35, 35, 37, 36, 36, 36, 41, 37, 38, 42, 40, 32, 45, 34, 34, 51, 41, 41],
    181)
  }
  document.getElementById("EC").onclick = function () {
    paginaPopup(-1239, -78.183406, 'Ecuador',
    [1.81, 2.45, 2.61, 2.84, 3.09, 3.28, 3.56, 3.74, 4.32, 4.30, 4.72, 5.48, 6.25, 7.05, 7.79, 7.71, 7.20, 7.89, 3.44],
    [9198, 9280, 9932, 10350, 10764, 11480, 11936, 12367, 12967, 13195, 13362, 13134, 12773, 12252, 11850, 11688, 12423, 11855, 26104],
    [1.81, 2.45, 2.61, 2.84, 3.09, 3.28, 3.56, 3.74, 4.32, 4.30, 4.72, 5.48, 6.25, 7.05, 7.79, 7.71, 7.20, 7.89, 7.44],
    [9198, 9280, 9932, 10350, 10764, 11480, 11936, 12367, 12967, 13195, 13362, 13134, 12773, 12252, 11850, 11688, 12423, 11855, 12081],
    142)
  }
  document.getElementById("EG").onclick = function () {
    paginaPopup(26.820553, 30.802498, 'Egypt',
    [2.47, 2.29, 1.98, 1.84, 1.73, 1.96, 2.28, 2.87, 3.52, 3.99, 4.55, 4.73, 5.65, 5.63, 6.23, 6.60, 6.61, 4.57, 6,58],
    [35910, 37713, 39321, 39871, 40448, 40550, 41837, 40264, 40988, 41981, 42542, 44175, 43759, 45374, 43449, 44657, 44615, 45655, 50229],
    [2.47, 2.29, 1.98, 1.84, 1.73, 1.96, 2.28, 2.87, 3.52, 3.99, 4.55, 4.73, 5.65, 5.63, 6.23, 6.60, 6.61, 4.57, 7.75],
    [35910, 37713, 39321, 39871, 40448, 40550, 41837, 40264, 40988, 41981, 42542, 44175, 43759, 45374, 43449, 44657, 44615, 45655, 42653],
    87)
  }
  document.getElementById("SV").onclick = function () {
    paginaPopup(13.794185, -88.89653, 'El Salvador',
    [1.62, 1.57, 1.71 , 1.87, 1.88, 1.90, 2.25, 2.20, 2.41, 2.32, 2.56, 2.83, 2.14, 2.21, 2.12, 2.06, 3.19, 3.33, 3.08],
    [6552, 7483, 6198, 6353, 6729, 6930, 6348, 6899, 6648, 6743, 6410, 6350, 8850, 8811, 9386, 9890, 6599, 6545, 7277],
    [1.62, 1.57, 1.71 , 1.87, 1.88, 1.90, 2.25, 2.20, 2.41, 2.32, 2.56, 2.83, 2.14, 2.21, 2.12, 2.06, 3.19, 3.33, 3.77],
    [6552, 7483, 6198, 6353, 6729, 6930, 6348, 6899, 6648, 6743, 6410, 6350, 8850, 8811, 9386, 9890, 6599, 6545, 5950],
    98)
  }
  document.getElementById("AE").onclick = function () {
    paginaPopup(23.424076, 53.847818, 'United Arab Emirates',
    [50.00, 47.81, 47.84, 51.29, 54.96, 65.19, 77.80, 73.77, 72.09, 45.07, 50.31, 60.18, 62.56, 63.30, 63.70, 55.39, 53.96, 56.36, 44.73],
    [1831, 1897, 2016, 2132, 2374, 2461, 2556, 3155, 3975, 5124, 5265, 5326, 5466, 5614, 5753, 5869, 6003, 6159, 7077],
    [50.00, 47.81, 47.84, 51.29, 54.96, 65.19, 77.80, 73.77, 72.09, 45.07, 50.31, 60.18, 62.56, 63.30, 63.70, 55.39, 53.96, 56.36, 49.37],
    [1831, 1897, 2016, 2132, 2374, 2461, 2556, 3155, 3975, 5124, 5265, 5326, 5466, 5614, 5753, 5869, 6003, 6159, 6412],
    22)
  }
  document.getElementById("ER").onclick = function () {
    paginaPopup(15.179384,39.782334,'Eritrea',
    [0.13, 0.20, 0.19, 0.21, 0.27, 0.26, 0.30, 0.33, 0.32, 0.45, 0.50, 0.63, 0.88, 1.32, 1.42, 1.53, 1.59, 1.76, 0.50],
    [5113, 3417, 3600, 3873, 3894, 4072, 3863, 3902, 4190, 3993, 4107, 4043, 4022, 4124, 3990, 3977, 3983, 3956, 4020],
    [0.13, 0.20, 0.19, 0.21, 0.27, 0.26, 0.30, 0.33, 0.32, 0.45, 0.50, 0.63, 0.88, 1.32, 1.42, 1.53, 1.59, 1.76, 0.50],
    [5113, 3417, 3600, 3873, 3894, 4072, 3863, 3902, 4190, 3993, 4107, 4043, 4022, 4124, 3990, 3977, 3983, 3956, 4019],
    149)
  }
  document.getElementById("EE").onclick = function () {
    paginaPopup(58.595272, 25.013607, 'Estonia',
    [2.47, 2.49, 3.32, 4.87, 6.20, 7.72, 9.47, 12.55, 16.20, 13.91, 15.59, 18.55, 17.76, 22.78, 24.44, 23.68, 28.48, 31.68, 30.22],
    [2092, 2330, 2009, 1837, 1766, 1648, 1628, 1612, 1358, 1284, 1135, 1134, 1179, 1003, 975, 863, 740, 737, 931],
    [2.47, 2.49, 3.32, 4.87, 6.20, 7.72, 9.47, 12.55, 16.20, 13.91, 15.59, 18.55, 17.76, 22.78, 24.44, 23.68, 28.48, 31.68, 40.07],
    [2092, 2330, 2009, 1837, 1766, 1648, 1628, 1612, 1358, 1284, 1135, 1134, 1179, 1003, 975, 863, 740, 737, 702],
    113)
  }
  document.getElementById("ET").onclick = function () {
    paginaPopup(9.145, 40.489673, 'Ethiopia',
    [0.08, 0.15, 0.15, 0.17, 0.21, 0.25, 0.31, 0.41, 0.56, 0.67, 0.64, 0.69, 0.94, 1.06, 1.24, 1.42, 1.57, 1.74, 2.15],
    [98246, 46960, 45920, 45571, 44601, 44108, 44396, 43838, 43910, 43649, 42609, 41982, 41552, 40787, 40464, 41019, 41864, 41834, 45576],
    [0.08, 0.15, 0.15, 0.17, 0.21, 0.25, 0.31, 0.41, 0.56, 0.67, 0.64, 0.69, 0.94, 1.06, 1.24, 1.42, 1.57, 1.74, 2.24],
    [98246, 46960, 45920, 45571, 44601, 44108, 44396, 43838, 43910, 43649, 42609, 41982, 41552, 40787, 40464, 41019, 41864, 41834, 43658],
    63)
  }
  document.getElementById("FJ").onclick = function () {
    paginaPopup(-16.578193, 179.4144133, 'Fiji',
    [3.58, 5.35, 4.82, 6.15, 7.15, 6.54, 6.67, 8.78, 8.05, 8.40, 6.88, 10.95, 10.16, 9.24, 9.88, 9.66, 9.30, 11.22, 9.89],
    [427, 292, 347, 342, 346, 417, 426, 352, 397, 310, 414, 313, 355, 412, 412, 410, 455, 408, 4.03],
    [3.58, 5.35, 4.82, 6.15, 7.15, 6.54, 6.67, 8.78, 8.05, 8.40, 6.88, 10.95, 10.16, 9.24, 9.88, 9.66, 9.30, 11.22, 9.94],
    [427, 292, 347, 342, 346, 417, 426, 352, 397, 310, 414, 313, 355, 412, 412, 410, 455, 408, 401],
    158)
  }
  document.getElementById("PH").onclick = function () {
    paginaPopup(12.879721, 121.774017, 'Philippines',
    [2.27, 2.19, 2.19, 2.24, 2.36, 2.65, 3.03, 3.93, 4.49, 4.19, 4.91, 5.54, 5.91, 5.42, 6.46, 6.28, 6.62, 6.78, 5.70],
    [32355, 32856, 33617, 33966, 35070, 35206, 36531, 34382, 35522, 36267, 36646, 36437, 38091, 45116, 39592, 41856, 41370, 41490, 57692],
    [2.27, 2.19, 2.19, 2.24, 2.36, 2.65, 3.03, 3.93, 4.49, 4.19, 4.91, 5.54, 5.91, 5.42, 6.46, 6.28, 6.62, 6.78, 6.79],
    [32355, 32856, 33617, 33966, 35070, 35206, 36531, 34382, 35522, 36267, 36646, 36437, 38091, 45116, 39592, 41856, 41370, 41490, 48462],
    108)
  }
  document.getElementById("FI").onclick = function () {
    paginaPopup(64.623548, 17.0935578, 'Finland',
    [27.60, 28.08, 31.06, 37.64, 41.03, 43.20, 45.32, 54.60, 60.22, 55.01, 56.27, 64.33, 63.38, 68.14, 71.39, 70.82, 70.88, 87.27, 66.26],
    [4128, 4166, 4077, 4125, 4353, 4295, 4337, 4245, 4277, 4150, 4000, 3866, 3683, 3605, 3477, 3297, 3072, 3144, 3732],
    [27.60, 28.08, 31.06, 37.64, 41.03, 43.20, 45.32, 54.60, 60.22, 55.01, 56.27, 64.33, 63.38, 68.14, 71.39, 70.82, 70.88, 87.27, 78.73],
    [4128, 4166, 4077, 4125, 4353, 4295, 4337, 4245, 4277, 4150, 4000, 3866, 3683, 3605, 3477, 3297, 3072, 3144, 3141],
    70)
  }
  document.getElementById("FR").onclick = function () {
    paginaPopup(46.227638, 2.213749, 'France',
    [29.09, 29.52, 32.24, 38.93, 49.79, 51.10, 55.27, 63.70, 69.21, 62.76, 61.42, 67.54, 63.90, 68.73, 71.27, 64.64, 53.72, 55.85, 20.84],
    [41436, 41066, 40888, 41674, 37431, 37808, 36867, 36645, 37038, 37661, 37805, 37229, 36900, 35909, 35116, 40564, 40282, 40602, 110114],
    [29.09, 29.52, 32.24, 38.93, 49.79, 51.10, 55.27, 63.70, 69.21, 62.76, 61.42, 67.54, 63.90, 68.73, 71.27, 64.64, 53.72, 55.85, 49.76],
    [41436, 41066, 40888, 41674, 37431, 37808, 36867, 36645, 37038, 37661, 37805, 37229, 36900, 35909, 35116, 40564, 40282, 40602, 46110],
    3)
  }
  document.getElementById("GA").onclick = function () {
    paginaPopup(-0.803689, 11.609444, 'Gabon',
    [5.22, 5.04, 5.21, 6.18, 7.16, 8.71, 9.09, 10.47, 12.58, 10.00, 12.09, 14.98, 14.23, 14.14, 14.76, 11.51, 10.98, 11.76, 12.57],
    [881, 901, 921, 947, 971, 980, 1005, 1043, 1073, 1040, 1013, 1024, 1006, 1025, 1006, 1013, 1032, 1004, 1129],
    [5.22, 5.04, 5.21, 6.18, 7.16, 8.71, 9.09, 10.47, 12.58, 10.00, 12.09, 14.98, 14.23, 14.14, 14.76, 11.51, 10.98, 11.76, 13.33],
    [881, 901, 921, 947, 971, 980, 1005, 1043, 1073, 1040, 1013, 1024, 1006, 1025, 1006, 1013, 1032, 1004, 1065],
    119)
  }
  document.getElementById("GM").onclick = function () {
    paginaPopup(13.443182, -15.310139, 'Gambia',
    [1.09, 0.93, 0.75, 0.63, 0.72, 0.70, 0.78, 0.88, 1.10 ,1.02, 1.05, 0.99, 0.96, 0.94, 0.85, 0.92, 0.96, 1.00, 1.87],
    [652, 668, 694, 704, 730, 806, 763, 826, 799, 804, 822, 826, 864, 875, 891, 903, 916, 933, 927],
    [1.09, 0.93, 0.75, 0.63, 0.72, 0.70, 0.78, 0.88, 1.10 ,1.02, 1.05, 0.99, 0.96, 0.94, 0.85, 0.92, 0.96, 1.00, 2.15],
    [652, 668, 694, 704, 730, 806, 763, 826, 799, 804, 822, 826, 864, 875, 891, 903, 916, 933, 803],
    164)
  }
  document.getElementById("GE").onclick = function () {
    paginaPopup(42.315407, 43.356892, 'Georgia',
    [2.41, 2.62, 1.75, 2.26, 2.60, 5.02, 5.95, 7.33, 5.77, 4.96, 5.27, 6.48, 6.80, 6.98, 7.24, 5.84, 6.04, 6.49, 3.38],
    [1237, 1265, 1870, 1706, 1910, 1238, 1266, 1354, 2168, 2129, 2171, 2190, 2290, 2270, 2239, 2340, 2310, 2266, 4594],
    [2.41, 2.62, 1.75, 2.26, 2.60, 5.02, 5.95, 7.33, 5.77, 4.96, 5.27, 6.48, 6.80, 6.98, 7.24, 5.84, 6.04, 6.49, 7.44],
    [1237, 1265, 1870, 1706, 1910, 1238, 1266, 1354, 2168, 2129, 2171, 2190, 2290, 2270, 2239, 2340, 2310, 2266, 2089],
    89)
  }
  document.getElementById("DE").onclick = function () {
    paginaPopup(51.165691, 10.451526, 'Germany',
    [51.06, 52.18, 54.49, 64.94, 75.79, 77.47, 83.06, 100.11, 106.17, 95.80, 91.57, 103.58, 97.73, 99.67, 105.18, 91.36, 78.93, 83.95, 47.84],
    [34523, 34201, 34296, 34606, 33309, 33024, 32280, 30650, 31511, 31832, 33312, 32988, 32931, 34133, 34667, 36496, 39179, 38762, 72872],
    [51.06, 52.18, 54.49, 64.94, 75.79, 77.47, 83.06, 100.11, 106.17, 95.80, 91.57, 103.58, 97.73, 99.67, 105.18, 91.36, 78.93, 83.95, 87.59],
    [34523, 34201, 34296, 34606, 33309, 33024, 32280, 30650, 31511, 31832, 33312, 32988, 32931, 34133, 34667, 36496, 39179, 38762, 39801],
    48)
  }
  document.getElementById("GH").onclick = function () {
    paginaPopup(7.946527,-1.023194, 'Ghana',
    [0.46, 0.46, 0.52, 0.62, 0.70, 0.82, 1.50, 1.81, 2.08, 1.86, 2.25, 2.71, 2.81, 3.13, 2.48, 2.26, 2.53, 2.80, 4.53],
    [9697, 10332, 10721, 11038, 11440, 11814, 12223, 12315, 12322, 12606, 12865, 13159, 13430, 13783, 14187, 14914, 15285, 15254, 14521],
    [0.46, 0.46, 0.52, 0.62, 0.70, 0.82, 1.50, 1.81, 2.08, 1.86, 2.25, 2.71, 2.81, 3.13, 2.48, 2.26, 2.53, 2.80, 4.64],
    [9697, 10332, 10721, 11038, 11440, 11814, 12223, 12315, 12322, 12606, 12865, 13159, 13430, 13783, 14187, 14914, 15285, 15254, 14186],
    34)
  }
  document.getElementById("JM").onclick = function () {
    paginaPopup(18.109581, -77.297508, 'Jamaica',
    [7.79, 7.43, 9.13, 9.76, 11.04, 9.43, 9.71, 8.55, 7.80, 6.09, 8.40, 7.74, 7.39, 7.21, 6.96, 6.98, 7.30, 7.84, 9.43],
    [1025, 1115, 942, 854, 815, 1052, 1085, 1327, 1550, 1745, 1387, 1648, 1767, 1748, 1763, 1795, 1700, 1663, 1333],
    [7.79, 7.43, 9.13, 9.76, 11.04, 9.43, 9.71, 8.55, 7.80, 6.09, 8.40, 7.74, 7.39, 7.21, 6.96, 6.98, 7.30, 7.84, 12.19],
    [1025, 1115, 942, 854, 815, 1052, 1085, 1327, 1550, 1745, 1387, 1648, 1767, 1748, 1763, 1795, 1700, 1663, 1031],
    166)
  }
  document.getElementById("JP").onclick = function () {
    paginaPopup(36.204824, 138.252924, 'Japan',
    [59.56, 53.24, 50.45, 52.84, 47.53, 56.90, 55.92, 55.18, 61.82, 64.15, 67.70, 59.11, 76.33, 64.96, 63.05, 58.48, 63.17, 61.76, 66.31],
    [73805, 73131, 73327, 75638, 91238, 75380, 73112, 73826, 73523, 73598, 75965, 94114, 73469, 71767, 69549, 67905, 70729, 71682, 74507],
    [59.56, 53.24, 50.45, 52.84, 47.53, 56.90, 55.92, 55.18, 61.82, 64.15, 67.70, 59.11, 76.33, 64.96, 63.05, 58.48, 63.17, 61.76, 69.50],
    [73805, 73131, 73327, 75638, 91238, 75380, 73112, 73826, 73523, 73598, 75965, 94114, 73469, 71767, 69549, 67905, 70729, 71682, 71039],
    40)
  }
  document.getElementById("DJ").onclick = function () {
    paginaPopup(11.825138, 42.590275, 'Djibouti',
    [1.33, 1.37, 1.39, 1.45, 1.38, 1.64, 1.35, 1.92, 2.03, 2.23, 2.43, 2.63, 2.84, 2.71, 2.96, 3.14, 3.51, 3.13, 4.17],
    [414, 417, 425, 429, 484, 433, 569, 442, 491, 470, 464, 471, 476, 488, 492, 520, 503, 511, 738],
    [1.33, 1.37, 1.39, 1.45, 1.38, 1.64, 1.35, 1.92, 2.03, 2.23, 2.43, 2.63, 2.84, 2.71, 2.96, 3.14, 3.51, 3.13, 4.55],
    [414, 417, 425, 429, 484, 433, 569, 442, 491, 470, 464, 471, 476, 488, 492, 520, 503, 511, 677],
    105)
  }
  document.getElementById("JO").onclick = function () {
    paginaPopup(30.585164, 36.238414, 'Jordan',
    [3.70, 3.90, 4.29, 4.56, 5.16, 5.26, 6.37, 7.27, 9.23, 10.13, 11.06, 11.84, 12.12, 12.37, 12.53, 12.47, 11.94, 11.00, 5.86],
    [2138, 2152, 2088, 2089, 2067, 2232, 2201, 2190, 2204, 2159, 2168, 2174, 2235, 2329, 2406, 2495, 2653, 2690, 6782],
    [3.70, 3.90, 4.29, 4.56, 5.16, 5.26, 6.37, 7.27, 9.23, 10.13, 11.06, 11.84, 12.12, 12.37, 12.53, 12.47, 11.94, 11.00, 13.40],
    [2138, 2152, 2088, 2089, 2067, 2232, 2201, 2190, 2204, 2159, 2168, 2174, 2235, 2329, 2406, 2495, 2653, 2690, 2967],
    20)
  }
  document.getElementById("GR").onclick = function () {
    paginaPopup(39.074208, 21.824312, 'Greece',
    [25.89, 28.45, 32.69, 42.91, 52.92, 52.78, 60.63, 67.19, 79.11, 74.71, 70.13, 75.76, 58.14, 59.32, 59.88, 42.74, 46.25, 48.66, 19.24],
    [4636, 4406, 4325, 4322, 4171, 4304, 4131, 4346, 4108, 4046, 3904, 3472, 3868, 3710, 3638, 4215, 3842, 3792, 8712],
    [25.89, 28.45, 32.69, 42.91, 52.92, 52.78, 60.63, 67.19, 79.11, 74.71, 70.13, 75.76, 58.14, 59.32, 59.88, 42.74, 46.25, 48.66, 43.16],
    [4636, 4406, 4325, 4322, 4171, 4304, 4131, 4346, 4108, 4046, 3904, 3472, 3868, 3710, 3638, 4215, 3842, 3792, 3885],
    140)
  }
  document.getElementById("GD").onclick = function () {
    paginaPopup(12.262776, -61.604171, 'Grenada',
    [10.29, 10.52, 11.44, 13.45, 8.79, 11.10, 12.72, 13.81, 15.03, 13.76, 12.76, 12.88, 13.48, 13.94, 14.81, 15.38, 16.57, 17.26, 19.56],
    [46, 45, 43, 40, 62, 57, 50, 50, 50, 51, 55, 55, 54, 55, 56, 59, 58, 59, 51],
    [10.29, 10.52, 11.44, 13.45, 8.79, 11.10, 12.72, 13.81, 15.03, 13.76, 12.76, 12.88, 13.48, 13.94, 14.81, 15.38, 16.57, 17.26, 19.96],
    [46, 45, 43, 40, 62, 57, 50, 50, 50, 51, 55, 55, 54, 55, 56, 59, 58, 59, 50],
    197)
  }
  document.getElementById("GT").onclick = function () {
    paginaPopup(15.783471,-90.230759, 'Guatemala',
    [2.02, 1.84, 2.05, 2.14, 2.12, 2.17, 2.23, 2.70, 2.89, 2.57, 2.91, 3.47, 3.75, 3.99, 4.44, 4.46, 4.53, 4.80, 3.75],
    [8718, 9313, 9250, 9382, 10354, 11505, 12414, 11589, 12402, 13439, 13022, 12599, 12322, 12357, 12102, 13074, 13881, 14404, 20019],
    [2.02, 1.84, 2.05, 2.14, 2.12, 2.17, 2.23, 2.70, 2.89, 2.57, 2.91, 3.47, 3.75, 3.99, 4.44, 4.46, 4.53, 4.80, 4.93],
    [8718, 9313, 9250, 9382, 10354, 11505, 12414, 11589, 12402, 13439, 13022, 12599, 12322, 12357, 12102, 13074, 13881, 14404, 15216],
    64)
  }
  document.getElementById("GN").onclick = function () {
    paginaPopup(9.945587, -9.696645, 'Guinea',
    [0.36, 0.37, 0.43, 0.50, 0.52, 0.42, 0.61, 0.79, 0.98, 0.87, 0.97, 0.89, 1.03, 1.10, 1.18, 1.20, 1.27, 1.43, 1.87],
    [7650, 6895, 6225, 6217, 6385, 6305, 6534, 6750, 6567, 6870, 6706, 6793, 6824, 7079, 7019, 7018, 6951, 6957, 7623],
    [0.36, 0.37, 0.43, 0.50, 0.52, 0.42, 0.61, 0.79, 0.98, 0.87, 0.97, 0.89, 1.03, 1.10, 1.18, 1.20, 1.27, 1.43, 1.89],
    [7650, 6895, 6225, 6217, 6385, 6305, 6534, 6750, 6567, 6870, 6706, 6793, 6824, 7079, 7019, 7018, 6951, 6957, 7543],
    80)
  }
  document.getElementById("GW").onclick = function () {
    paginaPopup(11.803749, -15.180413, 'Guinea-Bissau',
    [0.31, 0.32, 0.35, 0.40, 0.44, 0.50, 0.48, 0.55, 0.70, 0.63, 0.67, 0.89, 0.80, 0.85, 0.82, 0.83, 0.94, 1.08, 1.00],
    [1153, 1167, 1157, 1153, 1156, 1129, 1176, 1217, 1191, 1262, 1205, 1174, 1185, 1176, 1223, 1190, 1187, 1181, 1303],
    [0.31, 0.32, 0.35, 0.40, 0.44, 0.50, 0.48, 0.55, 0.70, 0.63, 0.67, 0.89, 0.80, 0.85, 0.82, 0.83, 0.94, 1.08, 1.04],
    [1153, 1167, 1157, 1153, 1156, 1129, 1176, 1217, 1191, 1262, 1205, 1174, 1185, 1176, 1223, 1190, 1187, 1181, 1258],
    33)
  }
  document.getElementById("GQ").onclick = function () {
    paginaPopup(1.650801, 10.267895, 'Equatorial Guinea',
    [1.59, 2.35, 3.06, 4.24, 7.81, 12.14, 16.12, 20.54, 29.34, 22.39, 23.97, 32.72, 33.66, 32.71, 30.08, 17.89, 14.62, 15.54, 14.38],
    [517, 485, 457, 451, 430, 509, 464, 465, 484, 475, 474, 448, 451, 449, 478, 482, 499, 516, 634],
    [1.59, 2.35, 3.06, 4.24, 7.81, 12.14, 16.12, 20.54, 29.34, 22.39, 23.97, 32.72, 33.66, 32.71, 30.08, 17.89, 14.62, 15.54, 16.64],
    [517, 485, 457, 451, 430, 509, 464, 465, 484, 475, 474, 448, 451, 449, 478, 482, 499, 516, 548],
    101)
  }
  document.getElementById("GY").onclick = function () {
    paginaPopup(4.860416, -58.93018, 'Guyana',
    [1.00, 0.98, 0.99, 0.93, 1.05, 1.06, 1.74, 2.26, 2.39, 2.91, 2.81, 3.09, 3.43, 3.39, 3.91, 4.11, 4.65, 4.96, 4.82],
    [636, 640, 659, 718, 670, 697, 755, 699, 734, 649, 744, 766, 764, 805, 717, 699, 684, 671, 1033],
    [1.00, 0.98, 0.99, 0.93, 1.05, 1.06, 1.74, 2.26, 2.39, 2.91, 2.81, 3.09, 3.43, 3.39, 3.91, 4.11, 4.65, 4.96, 5.73],
    [636, 640, 659, 718, 670, 697, 755, 699, 734, 649, 744, 766, 764, 805, 717, 699, 684, 671, 869],
    99)
  }
  document.getElementById("HT").onclick = function () {
    paginaPopup(18.971187, -72.285215, 'Haiti',
    [0.36, 0.33, 0.32, 0.27, 0.25, 0.38, 0.42, 0.50, 0.52, 0.56, 0.03, 0.64, 0.66, 0.71, 0.73, 0.73, 0.63, 0.69, 1.09],
    [9939, 9937, 9926, 10077, 12923, 10268, 10410, 10614, 11416, 10789, 233397, 10740, 10852, 10830, 10981, 10911, 11497, 11068, 11170],
    [0.36, 0.33, 0.32, 0.27, 0.25, 0.38, 0.42, 0.50, 0.52, 0.56, 0.03, 0.64, 0.66, 0.71, 0.73, 0.73, 0.63, 0.69, 1.12],
    [9939, 9937, 9926, 10077, 12923, 10268, 10410, 10614, 11416, 10789, 233397, 10740, 10852, 10830, 10981, 10911, 11497, 11068, 10934],
    93)
  }
  document.getElementById("HN").onclick = function () {
    paginaPopup(15.199999, -86.241905, 'Honduras',
    [1.13, 1.18, 1.20, 1.21, 1.27, 1.41, 1.54, 1.69, , 1.90, 1.96, 2.21, 1.32, 1.38, 1.44, 1.45, 2.53, 2.66, 2.23],
    [5496, 5556, 5586, 5764, 5884, 5836, 5970, 6122, 6330, 6418, 6745, 6655, 11578, 11058, 11261, 11890, 6998, 7040, 9705],
    [1.13, 1.18, 1.20, 1.21, 1.27, 1.41, 1.54, 1.69, , 1.90, 1.96, 2.21, 1.32, 1.38, 1.44, 1.45, 2.53, 2.66, 3.29],
    [5496, 5556, 5586, 5764, 5884, 5836, 5970, 6122, 6330, 6418, 6745, 6655, 11578, 11058, 11261, 11890, 6998, 7040, 6594],
    125)
  }
  document.getElementById("IN").onclick = function () {
    paginaPopup(20.593684, 78.96288, 'India',
    [0.49, 0.50, 0.54, 0.65, 0.74, 0.85, 0.95, 1.23, 1.18, 1.28, 1.56, 1.68, 1.68, 1.72, 1.92, 2.00, 2.13, 2.43, 2.18],
    [858888, 877679, 851431, 839164, 855338, 866901, 877474, 891894, 917815, 939646, 964989, 988161, 987840, 984862, 969760, 960116, 973223, 977117, 1093482],
    [0.49, 0.50, 0.54, 0.65, 0.74, 0.85, 0.95, 1.23, 1.18, 1.28, 1.56, 1.68, 1.68, 1.72, 1.92, 2.00, 2.13, 2.43, 2.53],
    [858888, 877679, 851431, 839164, 855338, 866901, 877474, 891894, 917815, 939646, 964989, 988161, 987840, 984862, 969760, 960116, 973223, 977117, 944744],
    95)
  }
  document.getElementById("ID").onclick = function () {
    paginaPopup(-0.789275, 113.921327, 'Indonesia',
    [1.35, 1.31, 1.64, 1.99, 0.86, 2.50, 3.01, 3.79, 4.68, 5.00, 7.25, 8.85, 9.22, 9.27, 9.15, 8.96, 9.77, 10.64, 9.00],
    [111551, 111597, 108529, 107178, 270168, 103828, 109816, 103342, 98861, 97897, 94371, 91440, 90297, 89345, 88381, 87255, 86688, 86670, 108048],
    [1.35, 1.31, 1.64, 1.99, 0.86, 2.50, 3.01, 3.79, 4.68, 5.00, 7.25, 8.85, 9.22, 9.27, 9.15, 8.96, 9.77, 10.64, 11.34],
    [111551, 111597, 108529, 107178, 270168, 103828, 109816, 103342, 98861, 97897, 94371, 91440, 90297, 89345, 88381, 87255, 86688, 86670, 84910],
    7)
  }
  document.getElementById("IR").onclick = function () {
    paginaPopup(32.427908, 53.688046, 'Iran',
    [1.98, 2.24, 2.25, 1.75, 3.20, 3.82, 4.53, 5.93, 6.92, 7.15, 8.56, 10.52, 11.06, 8.94, 8.75, 8.01, 9.01, 9.37, 1.81],
    [50030, 51321, 51837, 79446, 53853, 53647, 53278, 53450, 53172, 52463, 51558, 50290, 49075, 47406, 45031, 43702, 42191, 42562, 96286],
    [1.98, 2.24, 2.25, 1.75, 3.20, 3.82, 4.53, 5.93, 6.92, 7.15, 8.56, 10.52, 11.06, 8.94, 8.75, 8.01, 9.01, 9.37, 4.24],
    [50030, 51321, 51837, 79446, 53853, 53647, 53278, 53450, 53172, 52463, 51558, 50290, 49075, 47406, 45031, 43702, 42191, 42562, 41191],
    61)
  }
  document.getElementById("IQ").onclick = function () {
    paginaPopup(33.223191, 43.679291, 'Iraq',
    [1.13, 0.86, 0.82, 0.66, 1.46, 1.84, 1.39, 1.82, 4.39, 4.25, 7.52, 7.15, 8.04, 6.28, 4.29, 3.92, 3.60, 3.75, 3.89],
    [20803, 20114, 21007, 21392, 22909, 24772, 42534, 44572, 27359, 23996, 24392, 23756, 24801, 34208, 50127, 42089, 43691, 48501, 39162],
    [1.13, 0.86, 0.82, 0.66, 1.46, 1.84, 1.39, 1.82, 4.39, 4.25, 7.52, 7.15, 8.04, 6.28, 4.29, 3.92, 3.60, 3.75, 5.77],
    [20803, 20114, 21007, 21392, 22909, 24772, 42534, 44572, 27359, 23996, 24392, 23756, 24801, 34208, 50127, 42089, 43691, 48501, 26354],
    53)
  }
  document.getElementById("IE").onclick = function () {
    paginaPopup(53.41291, -8.24389, 'Ireland',
    [58.13, 60.81, 73.30, 103.75, 125.75, 123.26, 143.38, 139.31, 145.12, 114.12, 127.74, 130.51, 132.10, 147.61, 154.08, 211.98, 224.65, 241.83, 109.23],
    [1578, 1648, 1603, 1457, 1420, 1579, 1480, 1759, 1721, 1894, 1601, 1693, 1577, 1491, 1530, 1244, 1224, 1239, 3448],
    [58.13, 60.81, 73.30, 103.75, 125.75, 123.26, 143.38, 139.31, 145.12, 114.12, 127.74, 130.51, 132.10, 147.61, 154.08, 211.98, 224.65, 241.83, 308.20],
    [1578, 1648, 1603, 1457, 1420, 1579, 1480, 1759, 1721, 1894, 1601, 1693, 1577, 1491, 1530, 1244, 1224, 1239, 1222],
    81)
  }
  document.getElementById("IS").onclick = function () {
    paginaPopup(64.963051, -19.020835, 'Iceland',
    [61.08, 70.96, 74.64, 101.07, 120.49, 146.06, 105.97, 159.82, 125.56, 98.52, 88.41, 116.31, 108.39, 130.46, 129.04, 134.67, 156.20, 177.60, 131.44],
    [133, 104, 112, 102, 104, 104, 145, 119, 125, 118, 137, 116, 121, 109, 122, 114, 117, 120, 140],
    [61.08, 70.96, 74.64, 101.07, 120.49, 146.06, 105.97, 159.82, 125.56, 98.52, 88.41, 116.31, 108.39, 130.46, 129.04, 134.67, 156.20, 177.60, 165.78],
    [133, 104, 112, 102, 104, 104, 145, 119, 125, 118, 137, 116, 121, 109, 122, 114, 117, 120, 111],
    126)
  }
  document.getElementById("MH").onclick = function () {
    paginaPopup(7.131474, 171.184478, 'Marshall Islands',
    [2.35, 2.38, 2.47, 2.46, 2.54, 2.61, 2.73, 2.86, 2.90, 2.89, 3.13, 3.35, 3.59, 3.77, 3.81, 3.55, 3.93, 4.03, 5.25],
    [43, 44, 46, 47, 47, 48, 48, 48, 48, 48, 48, 47, 47, 46, 46, 46, 45, 45, 43],
    [2.35, 2.38, 2.47, 2.46, 2.54, 2.61, 2.73, 2.86, 2.90, 2.89, 3.13, 3.35, 3.59, 3.77, 3.81, 3.55, 3.93, 4.03, 5.25],
    [43, 44, 46, 47, 47, 48, 48, 48, 48, 48, 48, 47, 47, 46, 46, 46, 45, 45, 43],
    209)
  }
  document.getElementById("SB").onclick = function () {
    paginaPopup(-9.64571, 160.156194, 'Solomon Islands',
    [0.96, 0.91, 0.76, 0.73, 0.81, 0.87, 0.95, 0.94, 1.22, 1.13, 1.32, 1.80, 2.04, 2.09, 1.99, 2.08, 2.23, 2.32, 2.15],
    [414, 399, 410, 417, 421, 430, 437, 499, 453, 480, 469, 471, 473, 490, 532, 503, 499, 506, 657],
    [0.96, 0.91, 0.76, 0.73, 0.81, 0.87, 0.95, 0.94, 1.22, 1.13, 1.32, 1.80, 2.04, 2.09, 1.99, 2.08, 2.23, 2.32, 2.15],
    [414, 399, 410, 417, 421, 430, 437, 499, 453, 480, 469, 471, 473, 490, 532, 503, 499, 506, 657],
    73)
  }
  document.getElementById("IL").onclick = function () {
    paginaPopup(31.046051, 34.851612, 'Israel',
    [54.55, 49.86, 42.97, 50.39, 55.01, 58.58, 68.46, 82.59, 93.63, 95.04, 104.45, 120.83, 126.46, 147.28, 154.90, 146.56, 119.37, 129.74, 59.20],
    [2111, 2271, 2435, 2175, 2129, 2109, 1960, 1898, 2036, 1927, 1981, 1919, 1801, 1753, 1751, 1787, 2322, 2351, 5803],
    [54.55, 49.86, 42.97, 50.39, 55.01, 58.58, 68.46, 82.59, 93.63, 95.04, 104.45, 120.83, 126.46, 147.28, 154.90, 146.56, 119.37, 129.74, 141.32],
    [2111, 2271, 2435, 2175, 2129, 2109, 1960, 1898, 2036, 1927, 1981, 1919, 1801, 1753, 1751, 1787, 2322, 2351, 2431],
    137)
  }
  document.getElementById("IT").onclick = function () {
    paginaPopup(41.2036156, 8.2238657, 'Italy',
    [39.95, 39.84, 43.63, 56.28, 68.93, 70.89, 73.39, 82.95, 90.19, 81.20, 80.89, 87.87, 79.60, 81.89, 83.90, 68.63, 69.68, 73.55, 17.53],
    [26100, 26727, 26693, 25684, 24015, 24065, 24407, 24459, 24325, 24642, 24031, 23693, 23775, 23494, 22888, 23928, 23952, 23641, 99437],
    [39.95, 39.84, 43.63, 56.28, 68.93, 70.89, 73.39, 82.95, 90.19, 81.20, 80.89, 87.87, 79.60, 81.89, 83.90, 68.63, 69.68, 73.55, 67.46],
    [26100, 26727, 26693, 25684, 24015, 24065, 24407, 24459, 24325, 24642, 24031, 23693, 23775, 23494, 22888, 23928, 23952, 23641, 25833],
    28)
  }
  document.getElementById("KZ").onclick = function () {
    paginaPopup(48.019573,66.923684, 'Kazakhstan',
    [0.96, 0.94, 1.09, 1.34, 1.81, 2.37, 3.27, 4.32, 6.26, 6.08, 7.98, 10.32, 11.49, 13.09, 13.38, 12.40, 9.24, 10.62, 9.36],
    [17385, 21614, 20693, 21326, 22128, 22403, 23005, 22488, 19693, 17258, 16866, 16990, 16497, 16511, 15136, 13591, 13563, 13682, 16526],
    [0.96, 0.94, 1.09, 1.34, 1.81, 2.37, 3.27, 4.32, 6.26, 6.08, 7.98, 10.32, 11.49, 13.09, 13.38, 12.40, 9.24, 10.62, 11.22],
    [17385, 21614, 20693, 21326, 22128, 22403, 23005, 22488, 19693, 17258, 16866, 16990, 16497, 16511, 15136, 13591, 13563, 13682, 13787],
    151)
  }
  document.getElementById("KE").onclick = function () {
    paginaPopup(-0.023559, 37.906193, 'Kenya',
    [0.69, 0.71, 0.71, 0.79, 0.83, 0.92, 1.21, 1.45, 1.48, 1.64, 1.73, 1.78, 2.08, 2.25, 2.57, 2.64, 2.95, 3.02, 4.06],
    [16481, 16338, 16537, 16968, 17395, 18205, 18975, 19575, 21600, 20052, 20563, 20862, 21486, 21678, 21177, 21548, 21305, 22053, 22130],
    18)
  }
  document.getElementById("KG").onclick = function () {
    paginaPopup(41.1355977, 70.2512566, 'Kyrgyzstan',
    [0.37, 0.43, 0.43, 0.48, 0.56, 0.60, 0.67, 0.92, 1.23, 1.23, 1.11, 1.57, 1.74, 2.12, 2.19, 1.95, 2.22, 2.44, 1.58],
    [3434, 3261, 3447, 3665, 3601, 3682, 3831, 3730, 3789, 3468, 3954, 3617, 3475, 3156, 3107, 3108, 2771, 2781, 4209],
    [0.37, 0.43, 0.43, 0.48, 0.56, 0.60, 0.67, 0.92, 1.23, 1.23, 1.11, 1.57, 1.74, 2.12, 2.19, 1.95, 2.22, 2.44, 2.34],
    [3434, 3261, 3447, 3665, 3601, 3682, 3831, 3730, 3789, 3468, 3954, 3617, 3475, 3156, 3107, 3108, 2771, 2781, 2854],
    72)
  }
  document.getElementById("KI").onclick = function () {
    paginaPopup(-3.370417, -168.734039, 'Kiribati',
    [3.83, 1.04, 1.19, 1.47, 1.63, 1.76, 1.67, 1.92, 2.01, 1.86, 2.15, 2.44, 2.59, 2.54, 2.43, 2.30, 2.47, 2.66, 2.38],
    [16, 55, 55, 56, 57, 58, 59, 62, 63, 64, 65, 66, 66, 67, 67, 67, 67, 67, 76],
    [3.83, 1.04, 1.19, 1.47, 1.63, 1.76, 1.67, 1.92, 2.01, 1.86, 2.15, 2.44, 2.59, 2.54, 2.43, 2.30, 2.47, 2.66, 2.38],
    [16, 55, 55, 56, 57, 58, 59, 62, 63, 64, 65, 66, 66, 67, 67, 67, 67, 67, 76],
    183)
  }
  document.getElementById("KW").onclick = function () {
    paginaPopup(29.31166, 47.481766, 'Kuwait',
    [49.00, 45.52, 45.98, 57.83, 59.17, 87.87, 109.54, 119.94, 160.57, 103.68, 127.60, 173.30, 178.24, 180.48, 160.66, 106.51, 105.50, 110.90, 48.98],
    [659, 658, 719, 728, 897, 832, 848, 882, 852, 950, 840, 821, 895, 877, 914, 968, 946, 977, 2007],
    [49.00, 45.52, 45.98, 57.83, 59.17, 87.87, 109.54, 119.94, 160.57, 103.68, 127.60, 173.30, 178.24, 180.48, 160.66, 106.51, 105.50, 110.90, 91.55],
    [659, 658, 719, 728, 897, 832, 848, 882, 852, 950, 840, 821, 895, 877, 914, 968, 946, 977, 1074],
    159)
  }
  document.getElementById("LA").onclick = function () {
    paginaPopup(19.85627, 102.495496, 'Laos',
    [0.30, 0.31, 0.31, 0.36, 0.42, 0.49, 0.62, 0.78, 1.01, 1.10, 1.38, 1.72, 2.07, 2.44, 2.81, 3.08, 3.45, 3.75, 4.95],
    [5237, 5169, 5157, 5168, 5110, 5054, 5064, 4888, 4910, 4839, 4707, 4642, 4528, 4514, 4364, 4342, 4270, 4195, 3517],
    [0.30, 0.31, 0.31, 0.36, 0.42, 0.49, 0.62, 0.78, 1.01, 1.10, 1.38, 1.72, 2.07, 2.44, 2.81, 3.08, 3.45, 3.75, 4.95],
    [5237, 5169, 5157, 5168, 5110, 5054, 5064, 4888, 4910, 4839, 4707, 4642, 4528, 4514, 4364, 4342, 4270, 4195, 3517],
    138)
  }
  document.getElementById("LS").onclick = function () {
    paginaPopup(-29.609988, 28.233608, 'Lesotho',
    [0.31, 0.28, 0.25, 0.36, 0.46, 0.50, 0.54, 0.53, 0.55, 0.56, 0.72, 0.84, 0.81, 0.77, 0.80, 0.77, 0.73, 0.86, 0.53],
    [2549, 2647, 2781, 2873, 2954, 2996, 3019, 3064, 3052, 3002, 2972, 2981, 2961, 2948, 2938, 2912, 2817, 2725, 3156],
    [0.31, 0.28, 0.25, 0.36, 0.46, 0.50, 0.54, 0.53, 0.55, 0.56, 0.72, 0.84, 0.81, 0.77, 0.80, 0.77, 0.73, 0.86, 0.54],
    [2549, 2647, 2781, 2873, 2954, 2996, 3019, 3064, 3052, 3002, 2972, 2981, 2961, 2948, 2938, 2912, 2817, 2725, 3106],
    102)
  }
  document.getElementById("LV").onclick = function () {
    paginaPopup(56.860093, 22.3021037, 'Latvia',
    [1.92, 2.06, 2.38, 3.17, 4.10, 4.96, 5.71, 9.74, 13.00, 10.91, 10.22, 13.99, 13.56, 15.26, 15.21, 13.94, 15.46, 17.19, 14.39],
    [3773, 3703, 3666, 3373, 3181, 3216, 3240, 2850, 2453, 2158, 2108, 1840, 1889, 1803, 1870, 1754, 1620, 1605, 2102],
    [1.92, 2.06, 2.38, 3.17, 4.10, 4.96, 5.71, 9.74, 13.00, 10.91, 10.22, 13.99, 13.56, 15.26, 15.21, 13.94, 15.46, 17.19, 20.49],
    [3773, 3703, 3666, 3373, 3181, 3216, 3240, 2850, 2453, 2158, 2108, 1840, 1889, 1803, 1870, 1754, 1620, 1605, 1476],
    58)
  }
  document.getElementById("LB").onclick = function () {
    paginaPopup(33.854721, 35.862285, 'Lebanon',
    [9.16, 9.89, 10.67, 11.19, 11.96, 11.93, 8.37, 12.15, 13.69, 18.31, 19.34, 20.55, 19.94, 16.91, 17.27, 17.89, 19.97, 18.14, 10.66],
    [1715, 1624, 1634, 1633, 1594, 1624, 2369, 1840, 1942, 1763, 1808, 1776, 2005, 2482, 2525, 2516, 2253, 2582, 2849],
    [9.16, 9.89, 10.67, 11.19, 11.96, 11.93, 8.37, 12.15, 13.69, 18.31, 19.34, 20.55, 19.94, 16.91, 17.27, 17.89, 19.97, 18.14, 21.61],
    [1715, 1624, 1634, 1633, 1594, 1624, 2369, 1840, 1942, 1763, 1808, 1776, 2005, 2482, 2525, 2516, 2253, 2582, 1406],
    147)
  }
  document.getElementById("LR").onclick = function () {
    paginaPopup(6.428055, -9.429499, 'Liberia',
    [0.28, 0.23, 0.13, 0.08, 0.29, 0.34, 0.37, 0.44, 0.50, 0.66, 0.70, 0.80, 0.87, 0.96, 1.01, 1.03, 1.06, 1.09, 1.51],
    [1742, 2081, 3880, 4690, 1471, 1495, 1495, 1518, 1565, 1600, 1686, 1756, 1819, 1855, 1823, 1795, 1812, 1793, 1775],
    [0.28, 0.23, 0.13, 0.08, 0.29, 0.34, 0.37, 0.44, 0.50, 0.66, 0.70, 0.80, 0.87, 0.96, 1.01, 1.03, 1.06, 1.09, 1.59],
    [1742, 2081, 3880, 4690, 1471, 1495, 1495, 1518, 1565, 1600, 1686, 1756, 1819, 1855, 1823, 1795, 1812, 1793, 1692],
    130)
  }
  document.getElementById("LY").onclick = function () {
    paginaPopup(26.3351, 17.228331, 'Libya',
    [9.34, 9.57, 9.44, 9.95, 9.79, 13.44, 17.26, 20.95, 21.57, 19.79, 20.41, 0.51, 14.49, 15.56, 5.92, 6.20, 3.78, 5.58, 3.65],
    [2708, 2681, 2754, 2650, 2728, 2693, 2668, 2699, 3117, 3409, 3420, 51420, 4557, 3973, 7435, 5354, 7112, 5710, 6344],
    [9.34, 9.57, 9.44, 9.95, 9.79, 13.44, 17.26, 20.95, 21.57, 19.79, 20.41, 0.51, 14.49, 15.56, 5.92, 6.20, 3.78, 5.58, 4.73],
    [2708, 2681, 2754, 2650, 2728, 2693, 2668, 2699, 3117, 3409, 3420, 51420, 4557, 3973, 7435, 5354, 7112, 5710, 4885],
    4)
  }
  document.getElementById("LI").onclick = function () {
    paginaPopup(47.166, 9.555373, 'Liechtenstein', ['nd'], ['nd'], 211)
  }
  document.getElementById("LT").onclick = function () {
    paginaPopup(55.169438, 23.881275, 'Lithuania',
    [2.15, 2.16, 2.48, 3.08, 3.95, 4.66, 5.28, 6.20, 8.10, 9.19, 9.24, 10.32, 11.11, 12.14, 13.51, 13.04, 13.00, 13.30, 11.54],
    [4749, 5050, 4822, 4739, 4696, 4927, 4970, 5034, 4544, 3890, 3790, 3526, 3448, 3377, 3163, 3062, 2970, 2937, 4294],
    [2.15, 2.16, 2.48, 3.08, 3.95, 4.66, 5.28, 6.20, 8.10, 9.19, 9.24, 10.32, 11.11, 12.14, 13.51, 13.04, 13.00, 13.30, 19.88],
    [4749, 5050, 4822, 4739, 4696, 4927, 4970, 5034, 4544, 3890, 3790, 3526, 3448, 3377, 3163, 3062, 2970, 2937, 2492],
    134)
  }
  document.getElementById("LU").onclick = function () {
    paginaPopup(49.815273, 6.129583, 'Luxembourg',
    [79.17, 80.05, 74.60, 84.02, 117.92, 143.97, 141.87, 175.96, 186.33, 152.17, 167.06, 163.50, 163.47, 165.91, 166.86, 162.13, 157.12, 156.15, 87.45],
    [233, 229, 232, 225, 222, 217, 217, 214, 210, 212, 216, 220, 223, 225, 232, 239, 240, 246, 755],
    [79.17, 80.05, 74.60, 84.02, 117.92, 143.97, 141.87, 175.96, 186.33, 152.17, 167.06, 163.50, 163.47, 165.91, 166.86, 162.13, 157.12, 156.15, 254.06],
    [233, 229, 232, 225, 222, 217, 217, 214, 210, 212, 216, 220, 223, 225, 232, 239, 240, 246, 260],
    175)
  }
  document.getElementById("MK").onclick = function () {
    paginaPopup(41.608635, 21.745275, 'North Macedonia',
    [4.73, 3.83, 4.32, 5.29, 7.01, 8.55, 9.27, 9.90, 12.66, 13.17, 14.08, 14.92, 14.57, 15.82, 16.35, 14.92, 14.09, 14.34, 3.45],
    [748, 883, 785, 737, 683, 655, 670, 679, 643, 659, 629, 608, 614, 597, 601, 648, 669, 646, 3231],
    [4.73, 3.83, 4.32, 5.29, 7.01, 8.55, 9.27, 9.90, 12.66, 13.17, 14.08, 14.92, 14.57, 15.82, 16.35, 14.92, 14.09, 14.34, 15.02],
    [748, 883, 785, 737, 683, 655, 670, 679, 643, 659, 629, 608, 614, 597, 601, 648, 669, 646, 743],
    15)
  }
  document.getElementById("MG").onclick = function () {
    paginaPopup(-18.766947, 46.869107, 'Madagascar',
    [0.41, 0.45, 0.42, 0.53, 0.55, 0.59, 0.59, 0.71, 0.85, 0.84, 0.91, 0.89, 0.92, 0.95, 0.93, 0.92, 0.74, 0.16, 1.34],
    [8810, 8549, 8215, 8219, 8398, 8142, 8095, 8193, 8530, 9054, 8902, 9234, 9490, 9672, 10121, 10041, 12132, 12525, 9340],
    [0.41, 0.45, 0.42, 0.53, 0.55, 0.59, 0.59, 0.71, 0.85, 0.84, 0.91, 0.89, 0.92, 0.95, 0.93, 0.92, 0.74, 0.16, 1.38],
    [8810, 8549, 8215, 8219, 8398, 8142, 8095, 8193, 8530, 9054, 8902, 9234, 9490, 9672, 10121, 10041, 12132, 12525, 9079],
    9)
  }
  document.getElementById("MW").onclick = function () {
    paginaPopup(-13.254308, 34.301525, 'Malawi',
    [0.23, 0.24, 0.27, 0.37, 0.51, 0.53, 0.57, 0.62, 0.72, 0.80, 0.87, 0.95, 0.91, 0.84, 0.78, 0.72, 0.74, 0.75, 1.57],
    [7012, 6027, 6580, 6474, 6466, 6449, 6409, 6403, 6408, 6571, 6772, 6968, 7021, 6966, 6960, 7362, 7175, 7202, 6944],
    [0.23, 0.24, 0.27, 0.37, 0.51, 0.53, 0.57, 0.62, 0.72, 0.80, 0.87, 0.95, 0.91, 0.84, 0.78, 0.72, 0.74, 0.75, 1.61],
    [7012, 6027, 6580, 6474, 6466, 6449, 6409, 6403, 6408, 6571, 6772, 6968, 7021, 6966, 6960, 7362, 7175, 7202, 6755],
    121)
  }
  document.getElementById("MV").onclick = function () {
    paginaPopup(3.202778, 73.22068, 'Maldives',
    [5.26, 6.07, 7.54, 10.17, 4.76, 11.18, 14.86, 15.1, 18.78, 20.18, 23.06, 26.57, 27.86, 29.55, 32.19, 34.05, 36.69, 39.56, 21.26],
    [100, 96, 93, 92, 224, 90, 91, 90, 90, 87, 86, 86, 86, 87, 90, 93, 96, 99, 172],
    [5.26, 6.07, 7.54, 10.17, 4.76, 11.18, 14.86, 15.1, 18.78, 20.18, 23.06, 26.57, 27.86, 29.55, 32.19, 34.05, 36.69, 39.56, 29.46],
    [100, 96, 93, 92, 224, 90, 91, 90, 90, 87, 86, 86, 86, 87, 90, 93, 96, 99, 124],
    199)
  }
  document.getElementById("MY").onclick = function () {
    paginaPopup(4.210484, 101.975766, 'Malaysia',
    [6.46, 6.91, 7.48, 8.03, 9.18, 10.52, 11.92, 13.53, 14.87, 14.55, 16.27, 18.62, 20.99, 22.28, 21.65, 20.56, 19.53, 18.86, 19.44],
    [11310, 11081, 11152, 11630, 11831, 11704, 11679, 11914, 12512, 13176, 13028, 12672, 12824, 13046, 13979, 14214, 14339, 14717, 15762],
    [6.46, 6.91, 7.48, 8.03, 9.18, 10.52, 11.92, 13.53, 14.87, 14.55, 16.27, 18.62, 20.99, 22.28, 21.65, 20.56, 19.53, 18.86, 20.03],
    [11310, 11081, 11152, 11630, 11831, 11704, 11679, 11914, 12512, 13176, 13028, 12672, 12824, 13046, 13979, 14214, 14339, 14717, 15299],
    107)
  }
  document.getElementById("ML").onclick = function () {
    paginaPopup(17.570692, -3.996166, 'Mali',
    [0.28, 0.30, 0.29, 0.38, 0.50, 0.63, 0.67, 0.75, 0.84, 0.92, 0.97, 1.06, 1.03, 1.05, 1.18, 1.11, 1.07, 1.03, 1.16],
    [10092, 10007, 10450, 9930, 8940, 8410, 8925, 8863, 9295, 9629, 9664, 9670, 10266, 11105, 10509, 11245, 11860, 12554, 13690],
    [0.28, 0.30, 0.29, 0.38, 0.50, 0.63, 0.67, 0.75, 0.84, 0.92, 0.97, 1.06, 1.03, 1.05, 1.18, 1.11, 1.07, 1.03, 1.18],
    [10092, 10007, 10450, 9930, 8940, 8410, 8925, 8863, 9295, 9629, 9664, 9670, 10266, 11105, 10509, 11245, 11860, 12554, 13421],
    26)
  }

  document.getElementById("MT").onclick = function () {
    paginaPopup(35.937496, 14.375416, 'Malta',
    [32.85, 33.54, 34.45, 37.49, 42.80, 46.78, 48.10, 51.64, 58.98, 59.08, 62.45, 66.50, 67.21, 70.23, 76.52, 77.35, 72.28, 72.09, 31.19],
    [118, 119, 119, 121, 122, 123, 125, 127, 126, 124, 124, 122, 123, 125, 125, 129, 135, 139, 259],
    [32.85, 33.54, 34.45, 37.49, 42.80, 46.78, 48.10, 51.64, 58.98, 59.08, 62.45, 66.50, 67.21, 70.23, 76.52, 77.35, 72.28, 72.09, 82.22],
    [118, 119, 119, 121, 122, 123, 125, 127, 126, 124, 124, 122, 123, 125, 125, 129, 135, 139, 136],
    198)
  }

  document.getElementById("MA").onclick = function () {
    paginaPopup(31.791702, -7.09262, 'Morocco',
    [2.09, 2.14, 2.12, 2.44, 2.87, 3.45, 3.82, 4.15, 4.74, 5.12, 5.24, 5.45, 3.43, 5.90, 5.90, 5.94, 5.82, 5.88, 3.84],
    [17411, 17314, 17291, 17084, 17425, 16594, 16416, 16246, 16316, 16334, 16436, 16400, 26237, 16054, 16133, 16017, 15849, 15792, 26320],
    [2.09, 2.14, 2.12, 2.44, 2.87, 3.45, 3.82, 4.15, 4.74, 5.12, 5.24, 5.45, 3.43, 5.90, 5.90, 5.94, 5.82, 5.88, 5.33],
    [17411, 17314, 17291, 17084, 17425, 16594, 16416, 16246, 16316, 16334, 16436, 16400, 26237, 16054, 16133, 16017, 15849, 15792, 18965],
    129)
  }

  document.getElementById("MR").onclick = function () {
    paginaPopup(21.00789, -10.940835, 'Mauritania',
    [0.81, 0.75, 0.78, 0.87, 1.07, 1.19, 1.53, 1.69, 2.03, 2.15, 2.30, 2.46, 2.78, 3.03, 3.02, 2.80, 2.64, 2.58, 3.47],
    [1565, 1570, 1582, 1581, 1542, 1660, 1601, 1648, 1607, 1606, 1617, 1650, 1645, 1657, 1644, 1668, 1662, 1689, 2041],
    [0.81, 0.75, 0.78, 0.87, 1.07, 1.19, 1.53, 1.69, 2.03, 2.15, 2.30, 2.46, 2.78, 3.03, 3.02, 2.80, 2.64, 2.58, 4.12],
    [1565, 1570, 1582, 1581, 1542, 1660, 1601, 1648, 1607, 1606, 1617, 1650, 1645, 1657, 1644, 1668, 1662, 1689, 1717],
    46)
  }

  document.getElementById("MU").onclick = function () {
    paginaPopup(-20.348404, 57.552152, 'Mauritius',
    [8.01, 8.15, 7.86, 9.15, 10.85, 11.69, 12.19, 13.35, 15.09, 15.67, 16.50, 17.15, 19.84, 21.78, 22.65, 22.03, 22.28, 23.22, 18.67],
    [526, 530, 552, 532, 529, 535, 546, 548, 555, 565, 557, 558, 550, 553, 548, 558, 549, 545, 535],
    [8.01, 8.15, 7.86, 9.15, 10.85, 11.69, 12.19, 13.35, 15.09, 15.67, 16.50, 17.15, 19.84, 21.78, 22.65, 22.03, 22.28, 23.22, 19.02],
    [526, 530, 552, 532, 529, 535, 546, 548, 555, 565, 557, 558, 550, 553, 548, 558, 549, 545, 525],
    177)
  }

  document.getElementById("MX").onclick = function () {
    paginaPopup(23.634501, -102.552784, 'Mexico',
    [9.86, 11.06, 11.69, 12.21, 13.39, 15.18, 14.65, 15.80, 14.94, 12.36, 11.56, 11.88, 13.30, 14.55, 15.80, 14.94, 13.49, 10.84, 4.76],
    [56656, 55573, 56162, 56520, 55533, 51149, 58037, 58136, 66000, 73029, 81183, 82495, 80614, 76314, 72819, 75459, 78273, 93569, 205543],
    [9.86, 11.06, 11.69, 12.21, 13.39, 15.18, 14.65, 15.80, 14.94, 12.36, 11.56, 11.88, 13.30, 14.55, 15.80, 14.94, 13.49, 10.84, 11.99],
    [56656, 55573, 56162, 56520, 55533, 51149, 58037, 58136, 66000, 73029, 81183, 82495, 80614, 76314, 72819, 75459, 78273, 93569, 81698],
    21)
  }

  document.getElementById("FM").onclick = function () {
    paginaPopup(7.425554, 150.550812, 'Micronesia',
    [3.00, 3.09, 1.86, 3.30, 3.38, 3.56, 3.60, 3.59, 3.58, 3.94, 4.05, 4.37, 4.53, 4.70, 4.72, 4.94, 5.23, 5.35, 4.71],
    [72, 71, 118, 70, 70, 69, 68, 68, 68, 67, 67, 66, 66, 65, 65, 70, 65, 65, 85],
    [3.00, 3.09, 1.86, 3.30, 3.38, 3.56, 3.60, 3.59, 3.58, 3.94, 4.05, 4.37, 4.53, 4.70, 4.72, 4.94, 5.23, 5.35, 4.71],
    [72, 71, 118, 70, 70, 69, 68, 68, 68, 67, 67, 66, 66, 65, 65, 70, 65, 65, 85],
    184)
  }

  document.getElementById("MD").onclick = function () {
    paginaPopup(47.411631, 28.369885, 'Moldova',
    [0.33, 0.35, 0.40, 0.49, 1.30, 0.72, 0.85, 1.00, 1.32, 1.38, 1.71, 2.20, 2.65, 3.25, 3.30, 2.89, 2.87, 3.08, 3.13],
    [3794, 3759, 3728, 3749, 1828, 4022, 3914, 3769, 3674, 3674, 3620, 3219, 3071, 2893, 2950, 2942, 2821, 2710, 5341],
    [0.33, 0.35, 0.40, 0.49, 1.30, 0.72, 0.85, 1.00, 1.32, 1.38, 1.71, 2.20, 2.65, 3.25, 3.30, 2.89, 2.87, 3.08, 7.02],
    [3794, 3759, 3728, 3749, 1828, 4022, 3914, 3769, 3674, 3674, 3620, 3219, 3071, 2893, 2950, 2942, 2821, 2710, 2382],
    146)
  }

  document.getElementById("MC").onclick = function () {
    paginaPopup(43.750298, 7.412841, 'Principality of Monaco', ['nd'], ['nd'], 224 )
  }

  document.getElementById("MN").onclick = function () {
    paginaPopup(46.862496, 103.846656, 'Mongolia',
    [0.48, 0.48, 0.53, 0.60, 0.73, 0.85, 1.07, 1.38, 1.81, 1.85, 2.06, 2.75, 3.93, 4.81, 4.80, 4.43, 4.11, 3.81, 4.43],
    [2121, 2169, 2195, 2266, 2340, 2416, 2423, 2404, 2376, 2347, 2398, 2367, 2382, 2358, 2346, 2352, 2366, 2397, 2697],
    [0.48, 0.48, 0.53, 0.60, 0.73, 0.85, 1.07, 1.38, 1.81, 1.85, 2.06, 2.75, 3.93, 4.81, 4.80, 4.43, 4.11, 3.81, 4.43],
    [2121, 2169, 2195, 2266, 2340, 2416, 2423, 2404, 2376, 2347, 2398, 2367, 2382, 2358, 2346, 2352, 2366, 2397, 2697],
    155)
  }

  document.getElementById("ME").onclick = function () {
    paginaPopup(42.708678, 19.37439, 'Montenegro',
    [3.15, 3.27, 3.41, 4.24, 5.47, 6.53, 7.90, 9.66, 12.56, 13.44, 14.13, 15.09, 14.80, 14.74, 15.51, 15.60, 15.32, 15.99, 4.45],
    [327, 325, 320, 320, 316, 313, 306, 297, 289, 282, 276, 271, 267, 281, 267, 263, 262, 262, 986],
    [3.15, 3.27, 3.41, 4.24, 5.47, 6.53, 7.90, 9.66, 12.56, 13.44, 14.13, 15.09, 14.80, 14.74, 15.51, 15.60, 15.32, 15.99, 14.20],
    [327, 325, 320, 320, 316, 313, 306, 297, 289, 282, 276, 271, 267, 281, 267, 263, 262, 262, 309],
    112)
  }

  document.getElementById("MZ").onclick = function () {
    paginaPopup(-18.665695, 35.529562, 'Mozambique',
    [0.34, 0.37, 0.34, 0.40, 0.46, 0.52, 0.54, 0.57, 0.62, 0.69, 0.68, 0.73, 0.81, 0.91, 0.97, 0.89, 0.74, 0.66, 0.77],
    [13191, 12225, 12340, 12235, 12424, 12750, 13432, 14161, 14509, 14673, 14932, 15049, 15281, 15695, 15907, 16460, 16667, 16785, 16528],
    [0.34, 0.37, 0.34, 0.40, 0.46, 0.52, 0.54, 0.57, 0.62, 0.69, 0.68, 0.73, 0.81, 0.91, 0.97, 0.89, 0.74, 0.66, 0.78],
    [13191, 12225, 12340, 12235, 12424, 12750, 13432, 14161, 14509, 14673, 14932, 15049, 15281, 15695, 15907, 16460, 16667, 16785, 16365],
    39)
  }

  document.getElementById("NA").onclick = function () {
    paginaPopup(-22.95764, 18.49041, 'Namibia',
    [1.64, 1.85, 1.74, 2.05, 2.69, 3.45, 4.18, 4.59, 4.84, 4.87, 5.65, 6.37, 7.82, 8.23, 8.59, 8.14, 7.46, 7.24, 4.99],
    [2016, 1883, 1937, 1907, 1860, 1802, 1730, 1672, 1654, 1654, 1538, 1589, 1452, 1485, 1441, 1435, 1432, 1449, 1952],
    [1.64, 1.85, 1.74, 2.05, 2.69, 3.45, 4.18, 4.59, 4.84, 4.87, 5.65, 6.37, 7.82, 8.23, 8.59, 8.14, 7.46, 7.24, 5.54],
    [2016, 1883, 1937, 1907, 1860, 1802, 1730, 1672, 1654, 1654, 1538, 1589, 1452, 1485, 1441, 1435, 1432, 1449, 1756],
    85)
  }

  document.getElementById("NR").onclick = function () {
    paginaPopup(-0.522778, 166.931503, 'Nauru', ['nd'], ['nd'], 221)
  }

  document.getElementById("NP").onclick = function () {
    paginaPopup(28.394857, 84.124008, 'Nepal',
    [0.35, 0.36, 0.28, 0.38, 0.38, 0.46, 0.53, 0.60, 0.70, 0.78, 0.87, 0.96, 1.08, 1.13, 1.14, 0.75, 1.14, 1.26, 1.72],
    [14422, 14443, 18958, 15481, 16776, 15634, 14962, 14598, 14842, 15042, 15238, 15635, 15817, 16187, 16401, 25462, 16746, 16831, 17845],
    [0.35, 0.36, 0.28, 0.38, 0.38, 0.46, 0.53, 0.60, 0.70, 0.78, 0.87, 0.96, 1.08, 1.13, 1.14, 0.75, 1.14, 1.26, 2.03],
    [14422, 14443, 18958, 15481, 16776, 15634, 14962, 14598, 14842, 15042, 15238, 15635, 15817, 16187, 16401, 25462, 16746, 16831, 15087],
    148)
  }

  document.getElementById("NI").onclick = function () {
    paginaPopup(12.865416, -85.207229, 'Nicaragua',
    [1.73, 1.75, 1.75, 1.87, 2.02, 2.19, 2.38, 2.51, 2.87, 2.98, 3.22, 3.56, 3.84, 4.03, 4.14, 4.71, 5.07, 5.35, 4.56],
    [2566, 2591, 2600, 2620, 2599, 2612, 2527, 2608, 2494, 2419, 2398, 2368, 2392, 2432, 2493, 2296, 2259, 2269, 2520],
    [1.73, 1.75, 1.75, 1.87, 2.02, 2.19, 2.38, 2.51, 2.87, 2.98, 3.22, 3.56, 3.84, 4.03, 4.14, 4.71, 5.07, 5.35, 4.88],
    [2566, 2591, 2600, 2620, 2599, 2612, 2527, 2608, 2494, 2419, 2398, 2368, 2392, 2432, 2493, 2296, 2259, 2269, 2355],
    127)
  }

  document.getElementById("NE").onclick = function () {
    paginaPopup(17.607789, 8.081666, 'Niger',
    [0.21, 0.21, 0.21, 0.26, 0.31, 0.36, 0.39, 0.42, 0.52, 0.56, 0.62, 0.65, 0.70, 0.73, 0.76, 0.68, 0.67, 0.67, 1.03],
    [8351, 8429, 8345, 8158, 8055, 8428, 8558, 8532, 8384, 8358, 8324, 8585, 8765, 9121, 9379, 10430, 10397, 10464, 12108],
    [0.21, 0.21, 0.21, 0.26, 0.31, 0.36, 0.39, 0.42, 0.52, 0.56, 0.62, 0.65, 0.70, 0.73, 0.76, 0.68, 0.67, 0.67, 1.04],
    [8351, 8429, 8345, 8158, 8055, 8428, 8558, 8532, 8384, 8358, 8324, 8585, 8765, 9121, 9379, 10430, 10397, 10464, 12012],
    56)
  }

  document.getElementById("NG").onclick = function () {
    paginaPopup(9.08199, 8.675277, 'Nigeria',
    [0.78, 0.88, 1.10, 1.30, 1.54, 2.01, 2.62, 3.17, 4.023, 4.24, 4.47, 4.55, 5.09, 5.60, 5.33, 6.25, 4.96, 4.40, 5.00],
    [67306, 68205, 66639, 65508, 69350, 64684, 66759, 67564, 66610, 67530, 68957, 71255, 73440, 75876, 89894, 75912, 84208, 82758, 78694],
    [0.78, 0.88, 1.10, 1.30, 1.54, 2.01, 2.62, 3.17, 4.023, 4.24, 4.47, 4.55, 5.09, 5.60, 5.33, 6.25, 4.96, 4.40, 5.08],
    [67306, 68205, 66639, 65508, 69350, 64684, 66759, 67564, 66610, 67530, 68957, 71255, 73440, 75876, 89894, 75912, 84208, 82758, 77416],
    82)
  }

  document.getElementById("NO").onclick = function () {
    paginaPopup(60.472024, 8.468946, 'Norway',
    [59.41, 63.63, 67.39, 78.15, 95.48, 115.72, 129.49, 145.64, 161.11, 160.60, 161.94, 157.99, 190.19, 197.66, 205.25, 189.51, 166.93, 155.23, 115.71],
    [2515, 2469, 2445, 2379, 2368, 2319, 2292, 2308, 2356, 2405, 2433, 2579, 2382, 2440, 2381, 2319, 2329, 2356, 2869],
    [59.41, 63.63, 67.39, 78.15, 95.48, 115.72, 129.49, 145.64, 161.11, 160.60, 161.94, 157.99, 190.19, 197.66, 205.25, 189.51, 166.93, 155.23, 136.45],
    [2515, 2469, 2445, 2379, 2368, 2319, 2292, 2308, 2356, 2405, 2433, 2579, 2382, 2440, 2381, 2319, 2329, 2356, 2433],
    145)
  }

  document.getElementById("NZ").onclick = function () {
    paginaPopup(-40.900557, 174.885971, 'New Zeland',
    [29.78, 29.32, 29.98, 35.84, 46.68, 56.36, 58.89, 61.39, 61.91, 65.14, 64.58, 60.22, 82.89, 93.33, 98.06, 96.69, 94.77, 93.13, 99.53],
    [1660, 1663, 1698, 1735, 1713, 1698, 1707, 1763, 1795, 1785, 1820, 2137, 1777, 1728, 1743, 1756, 1776, 1802, 1843],
    [29.78, 29.32, 29.98, 35.84, 46.68, 56.36, 58.89, 61.39, 61.91, 65.14, 64.58, 60.22, 82.89, 93.33, 98.06, 96.69, 94.77, 93.13, 100.90],
    [1660, 1663, 1698, 1735, 1713, 1698, 1707, 1763, 1795, 1785, 1820, 2137, 1777, 1728, 1743, 1756, 1776, 1802, 1818],
    41)
  }

  document.getElementById("OM").onclick = function () {
    paginaPopup(21.512583, 55.923255, 'Oman',
    [9.01, 10.26, 10.13, 11.08, 13.62, 16.60, 18.21, 22.23, 27.15, 28.41, 28.44, 24.51, 26.99, 29.90, 30.38, 29.68, 27.12, 25.18, 18.01],
    [1620, 1612, 1668, 1616, 1532, 1462, 1484, 1576, 1607, 1634, 1768, 2043, 2284, 2328, 2312, 2335, 2419, 2436, 4183],
    [9.01, 10.26, 10.13, 11.08, 13.62, 16.60, 18.21, 22.23, 27.15, 28.41, 28.44, 24.51, 26.99, 29.90, 30.38, 29.68, 27.12, 25.18, 28.04],
    [1620, 1612, 1668, 1616, 1532, 1462, 1484, 1576, 1607, 1634, 1768, 2043, 2284, 2328, 2312, 2335, 2419, 2436, 2686],
    74)
  }

  document.getElementById("NL").onclick = function () {
    paginaPopup(52.132633, 5.291266, 'Netherlands',
    [67.15, 63.79, 63.11, 72.47, 90.01, 102.84, 113.38, 122.07, 127.66, 129.56, 128.15, 126.02, 118.10, 116.52, 110.82, 105.11, 96.00, 97.02, 42.78],
    [6218, 6269, 6291, 6305, 6136, 6072, 6023, 5997, 6174, 6231, 6359, 6567, 6833, 6949, 7198, 7305, 7571, 7531, 19063],
    [67.15, 63.79, 63.11, 72.47, 90.01, 102.84, 113.38, 122.07, 127.66, 129.56, 128.15, 126.02, 118.10, 116.52, 110.82, 105.11, 96.00, 97.02, 105.05],
    [6218, 6269, 6291, 6305, 6136, 6072, 6023, 5997, 6174, 6231, 6359, 6567, 6833, 6949, 7198, 7305, 7571, 7531, 7764],
    131)
  }

  document.getElementById("PK").onclick = function () {
    paginaPopup(30.375321, 69.345116, 'Pakistan',
    [0.68, 0.68, 0.71, 0.77, 0.89, 0.58, 1.15, 1.27, 1.36, 1.38, 1.41, 1.57, 1.72, 1.88, 1.93, 2.04, 2.24, 2.45, 2.52],
    [91814, 93275, 94882, 97137, 98802, 174738, 101940, 104432, 110919, 116114, 118948, 115621, 118792, 118828, 121094, 120512, 117333, 115539, 95393],
    [0.68, 0.68, 0.71, 0.77, 0.89, 0.58, 1.15, 1.27, 1.36, 1.38, 1.41, 1.57, 1.72, 1.88, 1.93, 2.04, 2.24, 2.45, 2.81],
    [91814, 93275, 94882, 97137, 98802, 174738, 101940, 104432, 110919, 116114, 118948, 115621, 118792, 118828, 121094, 120512, 117333, 115539, 85346],
    6)
  }

  document.getElementById("PW").onclick = function () {
    paginaPopup(7.51498, 134.58252, 'Palau', ['nd'], ['nd'], 188)
  }

  document.getElementById("PS").onclick = function () {
    paginaPopup(31.952162, 35.233154, 'Palestine',
    [1.33, 0.96, 0.66, 0.92, 0.89, 1.34, 0.80, 1.40, 0.86, 0.97, 4.76, 5.34, 4.79, 10.04, 5.41, 8.76, 10.03, 11.36, 5.21],
    [3245, 4205, 5358, 4298, 4790, 3531, 6014, 3838, 7564, 7276, 1829, 1919, 2313, 1225, 2327, 1438, 1337, 1284, 2813],
    [1.33, 0.96, 0.66, 0.92, 0.89, 1.34, 0.80, 1.40, 0.86, 0.97, 4.76, 5.34, 4.79, 10.04, 5.41, 8.76, 10.03, 11.36, 11.16],
    [3245, 4205, 5358, 4298, 4790, 3531, 6014, 3838, 7564, 7276, 1829, 1919, 2313, 1225, 2327, 1438, 1337, 1284, 1313],
    169)
  }

  document.getElementById("PA").onclick = function () {
    paginaPopup(8.537981, -80.782127, 'Panama',
    [8.35, 8.41, 8.21, 8.31, 10.23, 10.26, 9.61, 11.91, 12.35, 12.47, 13.67, 16.59, 19.39, 23.92, 25.46, 31.65, 28.74, 30.34, 8.39],
    [1337, 1348, 1434, 1492, 1328, 1443, 1706, 1615, 1839, 1979, 1960, 1903, 1897, 1735, 1784, 1555, 1835, 5776],
    [8.35, 8.41, 8.21, 8.31, 10.23, 10.26, 9.61, 11.91, 12.35, 12.47, 13.67, 16.59, 19.39, 23.92, 25.46, 31.65, 28.74, 30.34, 26.13],
    [1337, 1348, 1434, 1492, 1328, 1443, 1706, 1615, 1839, 1979, 1960, 1903, 1897, 1735, 1784, 1555, 1835, 1843],
    75)
  }

  document.getElementById("PG").onclick = function () {
    paginaPopup(-6.314993, 143.95555, 'Papua Nuova Guinea',
    [0.46, 0.39, 0.36, 0.42, 0.45, 0.53, 0.87, 0.96, 1.16, 1.17, 1.41, 1.74, 1.95, 1.98, 2.13, 1.97, 1.85, 1.96, 3.39],
    [6683, 6978, 7226, 7445, 7709, 8010, 8323, 8714, 8786, 9006, 9185, 9411, 9948, 9765, 9911, 10025, 10219, 10362, 6341],
    [0.46, 0.39, 0.36, 0.42, 0.45, 0.53, 0.87, 0.96, 1.16, 1.17, 1.41, 1.74, 1.95, 1.98, 2.13, 1.97, 1.85, 1.96, 3.39],
    [6683, 6978, 7226, 7445, 7709, 8010, 8323, 8714, 8786, 9006, 9185, 9411, 9948, 9765, 9911, 10025, 10219, 10362, 6332],
    52)
  }

  document.getElementById("PY").onclick = function () {
    paginaPopup(-23.442503, -58.443832, 'Paraguay',
    [3.65, 3.30, 2.14, 2.57, 2.85, 3.38, 3.77, 4.92, 6.02, 6.56, 8.21, 10.51, 10.38, 11.60, 11.74, 8.86, 8.78, 9.45, 5.27],
    [2039, 2108, 2677, 2322, 2556, 2345, 2561, 2544, 2791, 3099, 3015, 2918, 2917, 3028, 3121, 3716, 3738, 3757, 6101],
    [3.65, 3.30, 2.14, 2.57, 2.85, 3.38, 3.77, 4.92, 6.02, 6.56, 8.21, 10.51, 10.38, 11.60, 11.74, 8.86, 8.78, 9.45, 8.28],
    [2039, 2108, 2677, 2322, 2556, 2345, 2561, 2544, 2791, 3099, 3015, 2918, 2917, 3028, 3121, 3716, 3738, 3757, 3881],
    79)
  }

  document.getElementById("PE").onclick = function () {
    paginaPopup(-9.189967, -75.015152, 'Peru',
    [5.24, 6.18, 6.72, 6.21, 7.47, 6.12, 9.46, 9.48, 12.20, 12.49, 15.55, 17.96, 16.89, 15.85, 18.08, 16.62, 13.02, 14.26, 1.72],
    [8968, 7638, 7394, 8579, 8108, 11286, 8506, 9782, 8965, 8801, 8634, 8703, 10378, 11552, 10118, 10391, 13408, 13443, 106571],
    [5.24, 6.18, 6.72, 6.21, 7.47, 6.12, 9.46, 9.48, 12.20, 12.49, 15.55, 17.96, 16.89, 15.85, 18.08, 16.62, 13.02, 14.26, 13.61],
    [8968, 7638, 7394, 8579, 8108, 11286, 8506, 9782, 8965, 8801, 8634, 8703, 10378, 11552, 10118, 10391, 13408, 13443, 13505],
    1)
  }

  document.getElementById("PT").onclick = function () {
    paginaPopup(39.399872, -8.224454, 'Portugal',
    [22.50, 21.24, 21.10, 26.45, 32.90, 35.53, 38.06, 48.89, 52.31, 49.54, 47.90, 54.25, 49.78, 48.67, 43.37, 42.23, 43.30, 44.25, 17.77],
    [4769, 5171, 5741, 5630, 5198, 5029, 4970, 4461, 4554, 4477, 4527, 4108, 3955, 4227, 4818, 4297, 4335, 4510, 11715],
    [22.50, 21.24, 21.10, 26.45, 32.90, 35.53, 38.06, 48.89, 52.31, 49.54, 47.90, 54.25, 49.78, 48.67, 43.37, 42.23, 43.30, 44.25, 42.63],
    [4769, 5171, 5741, 5630, 5198, 5029, 4970, 4461, 4554, 4477, 4527, 4108, 3955, 4227, 4818, 4297, 4335, 4510, 4885],
    44)
  }

  document.getElementById("PL").onclick = function () {
    paginaPopup(51.919438, 19.145136, 'Poland',
    [6.09, 6.94, 7.14, 8.01, 10.29, 12.17, 12.53, 15.89, 19.30, 16.47, 18.31, 20.23, 19.31, 21.25, 23.19, 21.92, 19.60, 22.10, 10.87],
    [25763, 25043, 25388, 24811, 24966, 25345, 25193, 24751, 25363, 24297, 23828, 23784, 23580, 22453, 21400, 19827, 21910, 21676, 49601],
    [6.09, 6.94, 7.14, 8.01, 10.29, 12.17, 12.53, 15.89, 19.30, 16.47, 18.31, 20.23, 19.31, 21.25, 23.19, 21.92, 19.60, 22.10, 25.62],
    [25763, 25043, 25388, 24811, 24966, 25345, 25193, 24751, 25363, 24297, 23828, 23784, 23580, 22453, 21400, 19827, 21910, 21676, 21047],
    84)
  }
  document.getElementById("QA").onclick = function () {
    paginaPopup(25.354826, 51.183884, 'Qatar',
    [59.16, 76.50, 55.34, 61.86, 98.18, 118.51, 114.04, 162.94, 240.42, 204.59, 283.24, 400.72, 443.91, 411.01, 400.99, 350.44, 333.52, 180.77, 89.21],
    [273, 207, 312, 335, 283, 330, 474, 440, 435, 435, 402, 381, 383, 440, 468, 420, 414, 840, 1493],
    [59.16, 76.50, 55.34, 61.86, 98.18, 118.51, 114.04, 162.94, 240.42, 204.59, 283.24, 400.72, 443.91, 411.01, 400.99, 350.44, 333.52, 180.77, 106.72],
    [273, 207, 312, 335, 283, 330, 474, 440, 435, 435, 402, 381, 383, 440, 468, 420, 414, 840, 1248],
    165)
    chart.options.scales.yAxes[0].ticks.max = 450;
    chart.options.scales.yAxes[0].ticks.stepSize = 45;
    chart.update();

  }

  document.getElementById("GB").onclick = function () {
    paginaPopup(55.378051, -3.435973, 'United Kingdom',
    [76.54, 72.34, 80.62, 90.96, 105.21, 110.64, 116.80, 134.23, 122.41, 103.38, 109.11, 113.87, 117.19, 112.55, 119.41, 108.62, 115.22, 114.30, 26.57],
    [19530, 20330, 19883, 20304, 20640, 20610, 20853, 20728, 21390, 21081, 20457, 21057, 20784, 22264, 23128, 24266, 21003, 21001, 93673],
    [76.54, 72.34, 80.62, 90.96, 105.21, 110.64, 116.80, 134.23, 122.41, 103.38, 109.11, 113.87, 117.19, 112.55, 119.41, 108.62, 115.22, 114.30, 117.80],
    [19530, 20330, 19883, 20304, 20640, 20610, 20853, 20728, 21390, 21081, 20457, 21057, 20784, 22264, 23128, 24266, 21003, 21001, 21125],
    77)
  }

  document.getElementById("CZ").onclick = function () {
    paginaPopup(49.817492, 15.472962, 'Czech Republic',
    [7.92, 8.89, 10.90, 12.42, 15.49, 19.43, 24.02, 28.10, 34.99, 31.55, 31.42, 34.73, 32.23, 34.04, 33.10, 29.25, 32.21, 36.00, 12.77],
    [7070, 6910, 6838, 7295, 6991, 6376, 5893, 6131, 6121, 5946, 6009, 5973, 5856, 5598, 5714, 5812, 5511, 5458, 17369],
    [7.92, 8.89, 10.90, 12.42, 15.49, 19.43, 24.02, 28.10, 34.99, 31.55, 31.42, 34.73, 32.23, 34.04, 33.10, 29.25, 32.21, 36.00, 40.28],
    [7070, 6910, 6838, 7295, 6991, 6376, 5893, 6131, 6121, 5946, 6009, 5973, 5856, 5598, 5714, 5812, 5511, 5458, 5507],
    67)
  }

  document.getElementById("CF").onclick = function () {
    paginaPopup(6.611111, 20.939444, 'Central African Republic',
    [0.16, 0.15, 0.15, 0.18, 0.20, 0.21, 0.21, 0.23, 0.28, 0.28, 0.27, 0.32, 0.32, 0.13, 0.14, 0.22, 0.26, 0.24, 0.34],
    [5065, 5435, 5806, 5574, 5636, 5709, 6240, 6542, 6258, 6468, 6661, 6396, 6396, 10762, 11486, 6911, 6671, 8055, 6106],
    [0.16, 0.15, 0.15, 0.18, 0.20, 0.21, 0.21, 0.23, 0.28, 0.28, 0.27, 0.32, 0.32, 0.13, 0.14, 0.22, 0.26, 0.24, 0.35],
    [5065, 5435, 5806, 5574, 5636, 5709, 6240, 6542, 6258, 6468, 6661, 6396, 6396, 10762, 11486, 6911, 6671, 8055, 6043],
    132)
  }

  document.getElementById("DO").onclick = function () {
    paginaPopup(18.735693, -70.162651, 'Dominican Republic',
    [7.06, 6.77, 6.87, 4.86, 4.96, 7.94, 9.04, 11.26, 11.61, 12.11, 11.60, 13.76, 12.14, 8.55, 7.43, 7.50, 7.62, 8.22, 7.27],
    [3124, 3381, 3616, 4038, 4154, 4129, 3828, 3560, 3774, 3625, 4223, 3812, 4592, 6728, 8069, 8328, 8475, 8387, 9868],
    [7.06, 6.77, 6.87, 4.86, 4.96, 7.94, 9.04, 11.26, 11.61, 12.11, 11.60, 13.76, 12.14, 8.55, 7.43, 7.50, 7.62, 8.22, 9.62],
    [3124, 3381, 3616, 4038, 4154, 4129, 3828, 3560, 3774, 3625, 4223, 3812, 4592, 6728, 8069, 8328, 8475, 8387, 7459],
    32)
  }

  document.getElementById("RO").onclick = function () {
    paginaPopup(45.943161, 24.96676, 'Romania',
    [2.32, 2.57, 2.90, 3.87, 5.17, 6.97, 8.57, 12.74, 14.91, 12.67, 12.22, 15.53, 14.47, 17.17, 18.01, 16.40, 17.31, 18.96, 8.14],
    [14412, 14270, 14509, 14123, 13462, 13041, 13084, 12593, 13133, 12501, 12379, 10748, 10768, 10122, 10089, 9871, 9907, 10147, 27722],
    [2.32, 2.57, 2.90, 3.87, 5.17, 6.97, 8.57, 12.74, 14.91, 12.67, 12.22, 15.53, 14.47, 17.17, 18.01, 16.40, 17.31, 18.96, 23.15],
    [14412, 14270, 14509, 14123, 13462, 13041, 13084, 12593, 13133, 12501, 12379, 10748, 10768, 10122, 10089, 9871, 9907, 10147, 9753],
    59)
  }

  document.getElementById("RW").onclick = function () {
    paginaPopup(-1.940278, 29.873888, 'Rwanda',
    [0.16, 0.17, 0.20, 0.24, 0.30, 0.38, 0.47, 0.58, 0.75, 0.85, 0.91, 1.02, 1.10, 1.17, 1.21, 1.24, 1.25, 1.36, 1.62],
    [9555, 9031, 7545, 6917, 6392, 6241, 6164, 6051, 5911, 5719, 5799, 5860, 6058, 5904, 6010, 6059, 6175, 6129, 5813],
    [0.16, 0.17, 0.20, 0.24, 0.30, 0.38, 0.47, 0.58, 0.75, 0.85, 0.91, 1.02, 1.10, 1.17, 1.21, 1.24, 1.25, 1.36, 1.64],
    [9555, 9031, 7545, 6917, 6392, 6241, 6164, 6051, 5911, 5719, 5799, 5860, 6058, 5904, 6010, 6059, 6175, 6129, 5727],
    114)
  }

  document.getElementById("RU").onclick = function () {
    paginaPopup(61.52401, 105.318756, 'Russia',
    [0.74, 0.84, 0.92, 1.16, 1.64, 2.20, 3.18, 5.00, 6.18, 5.72, 6.40, 9.37, 10.38, 11.28, 9.88, 6.88, 7.34, 9.19, 6.81],
    [318716, 331634, 339296, 335173, 327123, 315914, 282785, 236412, 244463, 194576, 216867, 199358, 193774, 185353, 186779, 177590, 156495, 153835, 197349],
    [0.74, 0.84, 0.92, 1.16, 1.64, 2.20, 3.18, 5.00, 6.18, 5.72, 6.40, 9.37, 10.38, 11.28, 9.88, 6.88, 7.34, 9.19, 9.58],
    [318716, 331634, 339296, 335173, 327123, 315914, 282785, 236412, 244463, 194576, 216867, 199358, 193774, 185353, 186779, 177590, 156495, 153835, 140330],
    92)
  }

  document.getElementById("KN").onclick = function () {
    paginaPopup(17.357822, -62.782998, 'Saint Kitts and Nevis',
    [23.85, 27.9, 18.27, 16.26, 16.89, 14.94, 15.19, 13.90, 15.97, 14.92, 15.61, 15.90, 18.52, 17.98, 17.10, 16.27, 21.33, 22.51, 26.98],
    [16, 15, 24, 26, 27, 33, 38, 44, 42, 44, 41, 43, 36, 39, 45, 49, 29, 36, 31],
    [23.85, 27.9, 18.27, 16.26, 16.89, 14.94, 15.19, 13.90, 15.97, 14.92, 15.61, 15.90, 18.52, 17.98, 17.10, 16.27, 21.33, 22.51, 26.98],
    [16, 15, 24, 26, 27, 33, 38, 44, 42, 44, 41, 43, 36, 39, 45, 49, 29, 36, 31],
    201)
  }

  document.getElementById("LC").onclick = function () {
    paginaPopup(13.909444, -60.978893, 'Saint Lucia',
    [7.34, 8.55, 6.55, 8.54, 9.84, 9.28, 14.49, 12.03, 12.50, 10.39, 13.15, 11.21, 13.10, 11.79, 12.86, 14.60, 14.53, 14.84, 13.45],
    [97, 79, 104, 88, 83, 94, 72, 98, 34, 113, 98, 120, 103, 119, 114, 107, 109, 110, 115],
    [7.34, 8.55, 6.55, 8.54, 9.84, 9.28, 14.49, 12.03, 12.50, 10.39, 13.15, 11.21, 13.10, 11.79, 12.86, 14.60, 14.53, 14.84, 14.06],
    [97, 79, 104, 88, 83, 94, 72, 98, 34, 113, 98, 120, 103, 119, 114, 107, 109, 110, 110],
    194)
  }

  document.getElementById("VC").onclick = function () {
    paginaPopup(12.984305, -61.287228,'Saint Vincent and...',
    [7.82, 7.23, 7.23, 10.67, 6.23, 6.58, 9.56, 8.33, 10.88, 10.75, 11.66, 13.06, 11.03, 11.09, 9.14, 9.16, 9.02, 9.31, 10.48],
    [46, 54, 58, 41, 76, 76, 58, 71, 58, 57, 53, 47, 57, 59, 72, 75, 77, 77, 70],
    [7.82, 7.23, 7.23, 10.67, 6.23, 6.58, 9.56, 8.33, 10.88, 10.75, 11.66, 13.06, 11.03, 11.09, 9.14, 9.16, 9.02, 9.31, 10.48],
    [46, 54, 58, 41, 76, 76, 58, 71, 58, 57, 53, 47, 57, 59, 72, 75, 77, 77, 70],
    193)
  }

  document.getElementById("WS").onclick = function () {
    paginaPopup(-13.759029, -172.104629, 'Samoa',
    [3.13, 3.22, 11.66, 3.99, 4.89, 4.94, 7.46, 6.58, 7.79, 2.29, 7.80, 8.86, 8.28, 9.64, 9.64, 9.63, 9.42, 10.08, 6.56],
    [78, 77, 77, 77, 78, 85, 76, 76, 75, 223, 75, 76, 88, 76, 76, 76, 76, 76, 112],
    [3.13, 3.22, 11.66, 3.99, 4.89, 4.94, 7.46, 6.58, 7.79, 2.29, 7.80, 8.86, 8.28, 9.64, 9.64, 9.63, 9.42, 10.08, 6.56],
    [78, 77, 77, 77, 78, 85, 76, 76, 75, 223, 75, 76, 88, 76, 76, 76, 76, 76, 112],
    174)
  }

  document.getElementById("SM").onclick = function () {
    paginaPopup(43.94236, 12.457777, 'San Marino', ['nd'], ['nd'],218)
  }

  document.getElementById("ST").onclick = function () {
    paginaPopup(0.18636, 6.613081, 'São Tomé and Príncipe',
    [1.04, 0.97, 1.10, 1.28, 1.39, 1.69, 1.75, 1.79, 1.84, 2.47, 2.60, 3.03, 3.15, 11.79, 4.22, 3.84, 4.30, 4.73, 4.94],
    [66, 66, 65, 67, 67, 66, 68, 84, 91, 71, 71, 72, 75, 77, 77, 76, 76, 76, 87],
    [1.04, 0.97, 1.10, 1.28, 1.39, 1.69, 1.75, 1.79, 1.84, 2.47, 2.60, 3.03, 3.15, 11.79, 4.22, 3.84, 4.30, 4.73, 6.14],
    [66, 66, 65, 67, 67, 66, 68, 84, 91, 71, 71, 72, 75, 77, 77, 76, 76, 76, 70],
    179)
  }

  document.getElementById("SN").onclick = function () {
    paginaPopup(14.497401, -14.452362, 'Senegal',
    [0.78, 0.79, 0.71, 1.10, 1.23, 1.34, 1.38, 1.72, 2.07, 2.55, 2.53, 2.74, 2.70, 2.84, 2.89, 2.54, 2.71, 2.94, 3.60],
    [5422, 5570, 6856, 5685, 5919, 5923, 6175, 5971, 5903, 5807, 5824, 5937, 6003, 6075, 6229, 6378, 6391, 6517, 6289],
    [0.78, 0.79, 0.71, 1.10, 1.23, 1.34, 1.38, 1.72, 2.07, 2.55, 2.53, 2.74, 2.70, 2.84, 2.89, 2.54, 2.71, 2.94, 3.85],
    [5422, 5570, 6856, 5685, 5919, 5923, 6175, 5971, 5903, 5807, 5824, 5937, 6003, 6075, 6229, 6378, 6391, 6517, 5887],
    116)
  }

  document.getElementById("RS").onclick = function () {
    paginaPopup(44.016521, 21.005859, 'Serbia',
    [1.81, 3.23, 4.74, 6.12, 7.24, 7.72, 8.87, 11.69, 15.01, 10.99, 11.24, 13.48, 12.00, 13.88, 13.93, 11.80, 8.91, 9.82, 8.60],
    [4122, 4306, 3838, 3895, 3852, 3809, 3869, 3869, 3692, 3739, 3387, 3325, 3285, 3172, 3075, 3056, 4150, 4090, 7088],
    [1.81, 3.23, 4.74, 6.12, 7.24, 7.72, 8.87, 11.69, 15.01, 10.99, 11.24, 13.48, 12.00, 13.88, 13.93, 11.80, 8.91, 9.82, 15.53],
    [4122, 4306, 3838, 3895, 3852, 3809, 3869, 3869, 3692, 3739, 3387, 3325, 3285, 3172, 3075, 3056, 4150, 4090, 3925],
    111)
  }

  document.getElementById("SC").onclick = function () {
    paginaPopup(-4.679574, 55.491977, 'Seychelles',
    [10.34, 22.96, 16.30, 12.52, 21.23, 26.28, 20.85, 23.86, 23.72, 18.36, 22.63, 15.40, 33.27, 25.72, 26.57, 24.11, 22.02, 23.18, 18.45],
    [54, 25, 39, 53, 38, 34, 47, 42, 39, 42, 39, 63, 29, 47, 46, 52, 59, 59, 55],
    [10.34, 22.96, 16.30, 12.52, 21.23, 26.28, 20.85, 23.86, 23.72, 18.36, 22.63, 15.40, 33.27, 25.72, 26.57, 24.11, 22.02, 23.18, 18.45],
    [54, 25, 39, 53, 38, 34, 47, 42, 39, 42, 39, 63, 29, 47, 46, 52, 59, 59, 55],
    189)
  }

  document.getElementById("SL").onclick = function () {
    paginaPopup(8.460555,-11.779889, 'Sierra Leone',
    [0.12, 0.27, 0.31, 0.34, 0.34, 0.38, 0.43, 0.47, 0.57, 0.58, 0.62, 0.70, 0.89, 1.13, 1.15, 0.97, 0.85, 0.82, 0.81],
    [4148, 3251, 3265, 3345, 3470, 3492, 3530, 3748, 3548, 3875, 3761, 3808, 3880, 3949, 3973, 3957, 3912, 4167, 4351],
    [0.12, 0.27, 0.31, 0.34, 0.34, 0.38, 0.43, 0.47, 0.57, 0.58, 0.62, 0.70, 0.89, 1.13, 1.15, 0.97, 0.85, 0.82, 0.82],
    [4148, 3251, 3265, 3345, 3470, 3492, 3530, 3748, 3548, 3875, 3761, 3808, 3880, 3949, 3973, 3957, 3912, 4167, 4275],
    25)
  }

  document.getElementById("SG").onclick = function () {
    paginaPopup(1.352083, 103.8198366, 'Singapore',
    [100.12, 99.47, 99.93, 105.59, 145.87, 144.05, 169.03, 206.71, 218.52, 231.86, 286.39, 324.25, 343.83, 385.00, 404.68, 418.96, 289.44, 303.10, 323.55],
    [845, 792, 827, 862, 822, 846, 832, 815, 800, 762, 762, 784, 781, 727, 708, 669, 1000, 1016, 984],
    [100.12, 99.47, 99.93, 105.59, 145.87, 144.05, 169.03, 206.71, 218.52, 231.86, 286.39, 324.25, 343.83, 385.00, 404.68, 418.96, 289.44, 303.10, 333.38],
    [845, 792, 827, 862, 822, 846, 832, 815, 800, 762, 762, 784, 781, 727, 708, 669, 1000, 1016, 955],
    228)
  }

  document.getElementById("SY").onclick = function () {
    paginaPopup(34.802075, 38.996815, 'Syria',
    [3.72, 4.14, 4.05, 4.56, 9.06, 8.82, 9.28, 10.85, 11.10, 15.47, 17.75, 3.80, 1.02, 0.45, 0.27, 0.29, 0.19, 0.30, 3.83],
    [4695, 4606, 4809, 4316, 2491, 2931, 3202, 3302, 3689, 3206, 3102, 16096, 65407, 55005, 78709, 59923, 59886, 45412, 11657],
    [3.72, 4.14, 4.05, 4.56, 9.06, 8.82, 9.28, 10.85, 11.10, 15.47, 17.75, 3.80, 1.02, 0.45, 0.27, 0.29, 0.19, 0.30, 4.08],
    [4695, 4606, 4809, 4316, 2491, 2931, 3202, 3302, 3689, 3206, 3102, 16096, 65407, 55005, 78709, 59923, 59886, 45412, 10953],
    71)
  }

  document.getElementById("SK").onclick = function () {
    paginaPopup(48.669026, 19.699024, 'Slovakia',
    [8.48, 9.18, 10.55, 13.78, 17.00, 18.21, 20.98, 26.47, 28.78, 27.37, 27.64, 29.73, 24.97, 28.55, 29.02, 27.43, 29.31, 31.79, 19.73],
    [3114, 3039, 3022, 3083, 3062, 3132, 3062, 2968, 3174, 2957, 2947, 3005, 3405, 3139, 3166, 2912, 2790, 2737, 4823],
    [8.48, 9.18, 10.55, 13.78, 17.00, 18.21, 20.98, 26.47, 28.78, 27.37, 27.64, 29.73, 24.97, 28.55, 29.02, 27.43, 29.31, 31.79, 34.51],
    [3114, 3039, 3022, 3083, 3062, 3132, 3062, 2968, 3174, 2957, 2947, 3005, 3405, 3139, 3166, 2912, 2790, 2737, 2758],
    133)
  }

  document.getElementById("SI").onclick = function () {
    paginaPopup(46.151241, 14.995463, 'Slovenia',
    [11.96, 12.08, 14.31, 16.88, 20.89, 22.94, 22.58, 27.33, 33.45, 28.59, 28.84, 28.74, 26.97, 30.05, 36.41, 28.12, 29.91, 32.12, 10.94],
    [1543, 1565, 1489, 1591, 1493, 1435, 1590, 1597, 1515, 1599, 1515, 1624, 1564, 1457, 1247, 1395, 1358, 1373, 4353],
    [11.96, 12.08, 14.31, 16.88, 20.89, 22.94, 22.58, 27.33, 33.45, 28.59, 28.84, 28.74, 26.97, 30.05, 36.41, 28.12, 29.91, 32.12, 34.03],
    [1543, 1565, 1489, 1591, 1493, 1435, 1590, 1597, 1515, 1599, 1515, 1624, 1564, 1457, 1247, 1395, 1358, 1373, 1400],
    144)
  }

  document.getElementById("SO").onclick = function () {
    paginaPopup(5.152149, 46.199616, 'Somalia',
    [0.16, 0.10, 0.09, 0.11, 0.12, 0.17, 0.17, 0.15, 0.14, 0.08, 0.07, 0.23, 0.22, 0.44, 0.45, 0.46, 0.41, 0.38, 0.28],
    [9490, 9820, 10447, 10739, 11812, 10343, 10563, 12458, 13084, 13469, 14748, 13668, 15206, 13396, 13145, 13038, 14310, 17315, 15713],
    [0.16, 0.10, 0.09, 0.11, 0.12, 0.17, 0.17, 0.15, 0.14, 0.08, 0.07, 0.23, 0.22, 0.44, 0.45, 0.46, 0.41, 0.38, 0.29],
    [9490, 9820, 10447, 10739, 11812, 10343, 10563, 12458, 13084, 13469, 14748, 13668, 15206, 13396, 13145, 13038, 14310, 17315, 15583],
    29)
  }

  document.getElementById("ES").onclick = function () {
    paginaPopup(40.463667, -3.74922, 'Spain',
    [32.81, 35.84, 40.54, 49.63, 57.28, 62.43, 71.33, 84.31, 96.76, 93.85, 92.37, 94.88, 86.57, 84.20, 83.85, 72.04, 75.17, 80.23, 16.46],
    [16541, 15999, 15931, 16697, 17044, 16902, 16139, 15917, 15289, 14496, 14066, 14233, 14005, 14678, 14903, 15079, 14937, 14847, 69946],
    [32.81, 35.84, 40.54, 49.63, 57.28, 62.43, 71.33, 84.31, 96.76, 93.85, 92.37, 94.88, 86.57, 84.20, 83.85, 72.04, 75.17, 80.23, 71.17],
    [16541, 15999, 15931, 16697, 17044, 16902, 16139, 15917, 15289, 14496, 14066, 14233, 14005, 14678, 14903, 15079, 14937, 14847, 16175],
    118)
  }

  document.getElementById("LK").onclick = function () {
    paginaPopup(7.873054, 80.771797, 'Sri Lanka',
    [0.89, 1.00, 1.12, 1.28, 0.36, 1.34, 1.98, 1.63, 1.56, 1.55, 2.33, 4.26, 4.49, 4.97, 5.17, 5.33, 5.37, 5.64, 5.08],
    [16930, 14268, 13391, 13430, 51385, 16493, 12963, 18050, 23748, 24574, 22069, 13905, 13843, 13523, 13835, 13550, 13570, 13688, 14124],
    [0.89, 1.00, 1.12, 1.28, 0.36, 1.34, 1.98, 1.63, 1.56, 1.55, 2.33, 4.26, 4.49, 4.97, 5.17, 5.33, 5.37, 5.64, 5.15],
    [16930, 14268, 13391, 13430, 51385, 16493, 12963, 18050, 23748, 24574, 22069, 13905, 13843, 13523, 13835, 13550, 13570, 13688, 13920],
    136)
  }

  document.getElementById("US").onclick = function (US) {
    paginaPopup(37.09024, -95.712891, 'United States',
    [61.86, 60.39, 60.88, 62.80, 65.66, 67.51, 69.08, 71.07, 72.76, 72.98, 74.29, 74.42, 87.07, 78.05, 78.82, 76.51, 92.30, 95.13, 36.41],
    [151268, 160099, 164112, 166857, 170067, 176388, 182314, 185125, 183816, 180171, 183636, 190048, 169273, 195710, 202296, 216689, 184446, 186401, 525727],
    [61.86, 60.39, 60.88, 62.80, 65.66, 67.51, 69.08, 71.07, 72.76, 72.98, 74.29, 74.42, 87.07, 78.05, 78.82, 76.51, 92.30, 95.13, 106.14],
    [151268, 160099, 164112, 166857, 170067, 176388, 182314, 185125, 183816, 180171, 183636, 190048, 169273, 195710, 202296, 216689, 184446, 186401, 180329],
    150)
  }

  document.getElementById("ZA").onclick = function () {
    paginaPopup(-30.559482, 22.937506, 'South Africa',
    [2.76, 2.43, 2.26, 3.37, 4.29, 4.87, 5.18, 5.53, 5.43, 6.00, 7.78, 8.94, 8.24, 7.83, 7.41, 6.25, 6.05, 6.97, 3.25],
    [49424, 50048, 51115, 51944, 53342, 52962, 52464, 54125, 52831, 49357, 48238, 46560, 48127, 46821, 47324, 50817, 48964, 50099, 84476],
    [2.76, 2.43, 2.26, 3.37, 4.29, 4.87, 5.18, 5.53, 5.43, 6.00, 7.78, 8.94, 8.24, 7.83, 7.41, 6.25, 6.05, 6.97, 4.87],
    [49424, 50048, 51115, 51944, 53342, 52962, 52464, 54125, 52831, 49357, 48238, 46560, 48127, 46821, 47324, 50817, 48964, 50099, 56443],
    86)
  }

  document.getElementById("SD").onclick = function () {
    paginaPopup(12.862807, 30.217636, 'Sudan',
    [0.27, 0.40, 0.41, 0.46, 0.49, 0.85, 1.14, 1.47, 1.74, 1.67, 2.18, 2.41, 2.87, 2.97, 3.42, 4.44, 4.07, 5.62, 1.19],
    [37610, 26733, 29165, 30734, 35676, 25083, 25239, 24853, 24734, 25081, 23654, 24493, 23719, 24305, 24050, 21789, 23460, 21897, 19977],
    [0.27, 0.40, 0.41, 0.46, 0.49, 0.85, 1.14, 1.47, 1.74, 1.67, 2.18, 2.41, 2.87, 2.97, 3.42, 4.44, 4.07, 5.62, 1.29],
    [37610, 26733, 29165, 30734, 35676, 25083, 25239, 24853, 24734, 25081, 23654, 24493, 23719, 24305, 24050, 21789, 23460, 21897, 18416],
    49)
  }

  document.getElementById("SSD").onclick = function () {
    paginaPopup(6.856729, 29.4506773, 'South Sudan',
    [0, 0, 0, 0,0, 0, 0, 0, 2.26, 1.25, 2.27, 1.64, 1.32, 1.32, 1.33, 1.47, 0.32, 3.06, 0.66],
    [6642, 5473, 5612, 5612, 4961, 5031, 6387, 5952, 6878, 9775, 6935, 9912, 7977, 10494, 10388, 6677, 8139, 10341, 4850],
    [0, 0, 0, 0,0, 0, 0, 0, 2.26, 1.25, 2.27, 1.64, 1.32, 1.32, 1.33, 1.47, 0.32, 3.06, 0.67],
    [6642, 5473, 5612, 5612, 4961, 5031, 6387, 5952, 6878, 9775, 6935, 9912, 7977, 10494, 10388, 6677, 8139, 10341, 4787],
    229)
  }

  document.getElementById("SR").onclick = function () {
    paginaPopup(3.919305, -56.027783, 'Suriname',
    [3.51, 3.03, 3.89, 4.07, 4.36, 5.18, 7.94, 8.05, 8.88, 3.83, 11.56, 11.67, 14.87, 14.29, 15.64, 10.66, 7.04, 6.74, 6.13],
    [270, 275, 281, 313, 340, 346, 331, 365, 398, 414, 378, 379, 335, 360, 335, 449, 450, 455, 565],
    [3.51, 3.03, 3.89, 4.07, 4.36, 5.18, 7.94, 8.05, 8.88, 3.83, 11.56, 11.67, 14.87, 14.29, 15.64, 10.66, 7.04, 6.74, 7.79],
    [270, 275, 281, 313, 340, 346, 331, 365, 398, 414, 378, 379, 335, 360, 335, 449, 450, 455, 445],
    65)
  }

  document.getElementById("SE").onclick = function () {
    paginaPopup(60.128161, 18.643501, 'Sweden',
    [61.94, 51.57, 55.95, 71.78, 74.70, 81.01, 90.97, 101.01, 106.98, 91.18, 104.94, 122.62, 116.32, 120.30, 118.66, 97.38, 105.24,116.26, 33.28],
    [4200, 4659, 4725, 4619, 5116, 4808, 4623, 4835, 4810, 4717, 4659, 4598, 4681, 4816, 4841, 5115, 4867, 4607, 14341],
    [61.94, 51.57, 55.95, 71.78, 74.70, 81.01, 90.97, 101.01, 106.98, 91.18, 104.94, 122.62, 116.32, 120.30, 118.66, 97.38, 105.24,116.26, 101.83],
    [4200, 4659, 4725, 4619, 5116, 4808, 4623, 4835, 4810, 4717, 4659, 4598, 4681, 4816, 4841, 5115, 4867, 4607, 4686],
    36)
  }

  document.getElementById("CH").onclick = function () {
    paginaPopup(46.818188, 8.227512, 'Switzerland',
    [66.97, 59.57, 82.03, 96.81, 110.65, 117.73, 115.75, 127.05, 152.19, 151.09, 163.83, 190.20, 168.65, 180.94, 192.41, 177.85, 171.51, 174.36, 57.87],
    [4084, 4659, 3653, 3621, 3541, 3458, 3721, 3782, 3642, 3581, 3566, 3640, 3974, 3819, 3696, 3827, 3902, 3888, 11786],
    [66.97, 59.57, 82.03, 96.81, 110.65, 117.73, 115.75, 127.05, 152.19, 151.09, 163.83, 190.20, 168.65, 180.94, 192.41, 177.85, 171.51, 174.36, 159.19],
    [4084, 4659, 3653, 3621, 3541, 3458, 3721, 3782, 3642, 3581, 3566, 3640, 3974, 3819, 3696, 3827, 3902, 3888, 4284],
    13)
  }

  document.getElementById("SZ").onclick = function () {
    paginaPopup(-26.522503, 31.465866, 'Eswatini',
    [1.39, 0.40, 1.03, 1.09, 1.86, 2.13, 2.20, 2.30, 2.14, 2.31, 2.86, 3.15, 3.15, 3.00, 2.92, 2.63, 2.63, 3.21, 2.66],
    [1181, 3681, 1308, 1348, 1396, 1392, 1386, 1384, 1391, 1391, 1373, 1340, 1325, 1301, 1267, 1278, 1173, 1130, 1354],
    [1.39, 0.40, 1.03, 1.09, 1.86, 2.13, 2.20, 2.30, 2.14, 2.31, 2.86, 3.15, 3.15, 3.00, 2.92, 2.63, 2.63, 3.21, 3.08],
    [1181, 3681, 1308, 1348, 1396, 1392, 1386, 1384, 1391, 1391, 1373, 1340, 1325, 1301, 1267, 1278, 1173, 1130, 1169],
    153)
  }

  document.getElementById("TJ").onclick = function () {
    paginaPopup(38.861034, 71.276093, 'Tajikistan',
    [1.00, 1.00, 0.78, 7.73, 1.16, 1.42, 1.07, 1.39, 1.92, 1.79, 1.88, 2.25, 2.61, 1.87, 3.01, 2.55, 7.15, 2.26, 2.41],
    [1590, 1181, 1564, 1710, 1789, 1632, 2651, 2680, 2693, 2780, 3006, 2894, 2930, 2939, 3025, 3086, 973, 3173, 3089],
    [1.00, 1.00, 0.78, 7.73, 1.16, 1.42, 1.07, 1.39, 1.92, 1.79, 1.88, 2.25, 2.61, 1.87, 3.01, 2.55, 7.15, 2.26, 2.49],
    [1590, 1181, 1564, 1710, 1789, 1632, 2651, 2680, 2693, 2780, 3006, 2894, 2930, 2939, 3025, 3086, 973, 3173, 2999],
    122)
  }
  document.getElementById("TW").onclick = function () {
    paginaPopup(23.69781, 120.960515, 'Taiwan',
    [21.31, 19.83, 21.11, 22.34, 24.01, 25.32, 27.20, 29.91, 31.50, 29.37, 35.81, 38.06, 41.22, 42.27, 42.81, 43.16, 41.87, 45.05, 54.98],
    [15338, 14947, 14463, 14146, 14438, 14800, 14273, 13630, 13227, 13342, 12474, 12784, 12564, 12128, 12424, 12213, 12734, 12816, 12663],
    [21.31, 19.83, 21.11, 22.34, 24.01, 25.32, 27.20, 29.91, 31.50, 29.37, 35.81, 38.06, 41.22, 42.27, 42.81, 43.16, 41.87, 45.05, 55.01],
    [15338, 14947, 14463, 14146, 14438, 14800, 14273, 13630, 13227, 13342, 12474, 12784, 12564, 12128, 12424, 12213, 12734, 12816, 12656],
    19)
  }

  document.getElementById("TZ").onclick = function () {
    paginaPopup(-6.369028, 34.888822, 'Tanzania',
    [0.84, 0.84, 0.81, 0.93, 1.01, 1.11, 1.08, 1.24, 1.55, 1.57, 1.71, 1.79, 1.99, 2.25, 2.46, 2.25, 2.36, 2.47, 2.55],
    [16475, 16565, 17945, 16765, 16963, 17104, 17774, 18167, 18536, 19087, 19240, 19992, 20507, 20918, 20939, 21690, 21768, 22208, 22974],
    [0.84, 0.84, 0.81, 0.93, 1.01, 1.11, 1.08, 1.24, 1.55, 1.57, 1.71, 1.79, 1.99, 2.25, 2.46, 2.25, 2.36, 2.47, 2.55],
    [16475, 16565, 17945, 16765, 16963, 17104, 17774, 18167, 18536, 19087, 19240, 19992, 20507, 20918, 20939, 21690, 21768, 22208, 22953],
    88)
  }

  document.getElementById("TH").onclick = function () {
    paginaPopup(15.870032, 100.992541, 'Thailand',
    [0.84, 0.98, 0.95, 1.12, 2.51, 4.29, 5.75, 6.43, 10.74, 8.00, 9.92, 13.94, 16.01, 13.30, 9.31, 6.93, 5.45, 5.34, 9.52],
    [40867, 66235, 42803, 45137, 44196, 43160, 44442, 42884, 41787, 41943, 39924, 40682, 40130, 39411, 38451, 38617, 39558, 48268, 47981],
    [0.84, 0.98, 0.95, 1.12, 2.51, 4.29, 5.75, 6.43, 10.74, 8.00, 9.92, 13.94, 16.01, 13.30, 9.31, 6.93, 5.45, 5.34, 9.53],
    [40867, 66235, 42803, 45137, 44196, 43160, 44442, 42884, 41787, 41943, 39924, 40682, 40130, 39411, 38451, 38617, 39558, 48268, 47920],
    50)
  }

  document.getElementById("TL").onclick = function () {
    paginaPopup(-8.874217, 125.727539, 'East Timor',
    [0.53, 0.51, 0.57, 0.69, 0.64, 0.63, 0.74, 0.79, 0.99, 0.98, 0.98, 1.09, 1.09, 1.69, 1.26, 1.18, 1.25, 1.33, 3.39],
    [523, 531, 540, 484, 430, 423, 462, 448, 409, 400, 403, 407, 416, 424, 434, 446, 459, 466, 489],
    [0.53, 0.51, 0.57, 0.69, 0.64, 0.63, 0.74, 0.79, 0.99, 0.98, 0.98, 1.09, 1.09, 1.69, 1.26, 1.18, 1.25, 1.33, 3.39],
    [523, 531, 540, 484, 430, 423, 462, 448, 409, 400, 403, 407, 416, 424, 434, 446, 459, 466, 489],
    160)
  }

  document.getElementById("TG").onclick = function () {
    paginaPopup(8.619543, 0.824782, 'Togo',
    [0.53, 0.51, 0.57, 0.69, 0.64, 0.63, 0.74, 0.79, 0.99, 0.98, 0.98, 1.09, 1.09, 1.69, 1.26, 1.18, 1.25, 1.33, 1.68],
    [2817, 2881, 2994, 3056, 3539, 3631, 3194, 3379, 3358, 3432, 3500, 3561, 3553, 2549, 3625, 3541, 3542, 3579, 4096],
    [0.53, 0.51, 0.57, 0.69, 0.64, 0.63, 0.74, 0.79, 0.99, 0.98, 0.98, 1.09, 1.09, 1.69, 1.26, 1.18, 1.25, 1.33, 1.71],
    [2817, 2881, 2994, 3056, 3539, 3631, 3194, 3379, 3358, 3432, 3500, 3561, 3553, 2549, 3625, 3541, 3542, 3579, 4082],
    117)
  }

  document.getElementById("TO").onclick = function () {
    paginaPopup(-21.178986, -175.198242, 'Tonga',
    [4.78, 4.25, 4.15, 4.60, 5.21, 5.83, 6.54, 6.52, 7.77, 2.47, 8.03, 9.20, 10.27, 10.02, 9.65, 9.68, 9.12, 9.78, 13.86],
    [42, 43, 44, 44, 44, 45, 45, 46, 45, 129, 46, 46, 46, 45, 46, 45, 44, 44, 35],
    [4.78, 4.25, 4.15, 4.60, 5.21, 5.83, 6.54, 6.52, 7.77, 2.47, 8.03, 9.20, 10.27, 10.02, 9.65, 9.68, 9.12, 9.78, 13.86],
    [42, 43, 44, 44, 44, 45, 45, 46, 45, 129, 46, 46, 46, 45, 46, 45, 44, 44, 35],
    182)
  }

  document.getElementById("TT").onclick = function () {
    paginaPopup(10.691803, -61.222503, 'Trinidad e Tobago',
    [16.51, 11.07, 12.62, 13.54, 14.61, 16.09, 17.73, 19.48, 20.31, 16.47, 19.66, 25.36, 26.59, 27.69, 28.50, 26.64, 23.09, 23.62, 19.40],
    [494, 797, 714, 835, 909, 993, 1036, 1111, 1372, 1164, 1127, 1003, 969, 979, 964, 943, 942, 942, 1010],
    [16.51, 11.07, 12.62, 13.54, 14.61, 16.09, 17.73, 19.48, 20.31, 16.47, 19.66, 25.36, 26.59, 27.69, 28.50, 26.64, 23.09, 23.62, 22.17],
    [494, 797, 714, 835, 909, 993, 1036, 1111, 1372, 1164, 1127, 1003, 969, 979, 964, 943, 942, 942, 884],
    171)
  }

  document.getElementById("TN").onclick = function () {
    paginaPopup(33.886917, 9.537499, 'Tunisia',
    [3.47, 3.58, 3.73, 4.29, 5.04, 5.31, 5.66, 6.43, 7.49, 31.44, 7.43, 7.31, 7.71, 38.64, 8.11, 7.31, 7.17, 6.93, 3.70],
    [6191, 6160, 6197, 6395, 6193, 6078, 6073, 6049, 5988, 6048, 5930, 6271, 5839, 5875, 5872, 5902, 5831, 5762, 9642],
    [3.47, 3.58, 3.73, 4.29, 5.04, 5.31, 5.66, 6.43, 7.49, 31.44, 7.43, 7.31, 7.71, 38.64, 8.11, 7.31, 7.17, 6.93, 7.11],
    [6191, 6160, 6197, 6395, 6193, 6078, 6073, 6049, 5988, 6048, 5930, 6271, 5839, 5875, 5872, 5902, 5831, 5762, 5022],
    83)
  }

  document.getElementById("TR").onclick = function () {
    paginaPopup(38.963745, 35.243322, 'Turkey',
    [12.39, 9.55, 12.67, 15.57, 20.57, 25.48, 28.22, 34.59, 39.45, 57.10, 59.46, 65.60, 66.35, 48.48, 46.36, 45.41, 33.59, 32.93, 15.29],
    [22028, 20966, 18815, 20025, 19679, 19680, 19580, 19536, 19374, 11289, 12981, 12690, 13173, 19608, 20152, 18933, 25710, 25861, 42868],
    [12.39, 9.55, 12.67, 15.57, 20.57, 25.48, 28.22, 34.59, 39.45, 57.10, 59.46, 65.60, 66.35, 48.48, 46.36, 45.41, 33.59, 32.93, 29.48],
    [22028, 20966, 18815, 20025, 19679, 19680, 19580, 19536, 19374, 11289, 12981, 12690, 13173, 19608, 20152, 18933, 25710, 25861, 22226],
    37)
  }

  document.getElementById("TM").onclick = function () {
    paginaPopup(38.969719, 59.556278, 'Turkmenistan',
    [1.5, 1.68, 1.86, 2.72, 3.08, 3.50, 5.23, 6.17, 5.22, 12.90, 13.97, 19.83, 27.73, 25.11, 37.07, 28.66, 2.03, 21.46, 29.14],
    [1934, 2104, 2395, 2194, 2218, 2313, 2431, 2054, 3692, 1567, 1616, 1474, 1268, 1561, 1174, 1249, 17789, 1767, 1701],
    [1.5, 1.68, 1.86, 2.72, 3.08, 3.50, 5.23, 6.17, 5.22, 12.90, 13.97, 19.83, 27.73, 25.11, 37.07, 28.66, 2.03, 21.46, 29.14],
    [1934, 2104, 2395, 2194, 2218, 2313, 2431, 2054, 3692, 1567, 1616, 1474, 1268, 1561, 1174, 1249, 17789, 1767, 1701],
    141)
  }
  document.getElementById("TC").onclick = function () {
    paginaPopup(21.694025, -71.797928, 'Turks and Cacois',
    [64.52, 44.86, 45.84, 68.29, 80.93, 34.04, 48.53, 45.50, 71.89, 36.04, 31.22, 34.70, 31.12, 25.54, 82.40, 68.73, 63.36, 60.16, 140.22],
    [15, 17, 12, 27, 22, 21, 23, 29, 10, 13, 15, 16, 15, 16, 9, 11, 12, 13, 6],
    [64.52, 44.86, 45.84, 68.29, 80.93, 34.04, 48.53, 45.50, 71.89, 36.04, 31.22, 34.70, 31.12, 25.54, 82.40, 68.73, 63.36, 60.16, 140.22],
    [15, 17, 12, 27, 22, 21, 23, 29, 10, 13, 15, 16, 15, 16, 9, 11, 12, 13, 6],
    192)
  }

  document.getElementById("TV").onclick = function () {
    paginaPopup(-7.109535, 177.64933, 'Tuvalu', ['nd'],['nd'],220)
  }

  document.getElementById("UA").onclick = function () {
    paginaPopup(48.379433, 31.16558, 'Ukraine',
    [0.42, 0.50, 0.55, 0.69, 0.91, 1.23, 1.67, 2.16, 2.93, 2.39, 3.09, 3.85, 4.21, 5.10, 3.50, 2.78, 2.15, 2.65, 2.37],
    [73575, 75321, 76311, 72576, 71229, 69954, 64556, 65978, 61377, 48936, 43955, 42380, 41713, 35947, 40135, 34569, 45689, 44736, 62468],
    [0.42, 0.50, 0.55, 0.69, 0.91, 1.23, 1.67, 2.16, 2.93, 2.39, 3.09, 3.85, 4.21, 5.10, 3.50, 2.78, 2.15, 2.65, 3.38],
    [73575, 75321, 76311, 72576, 71229, 69954, 64556, 65978, 61377, 48936, 43955, 42380, 41713, 35947, 40135, 34569, 45689, 44736, 43935],
    17)
  }

  document.getElementById("UG").onclick = function () {
    paginaPopup(1.373333,32.290275, 'Uganda',
    [0.39, 0.40, 0.37, 0.35, 0.44, 0.57, 0.65, 0.82, 0.95, 1.22, 1.30, 1.33, 1.49, 1.53, 1.66, 1.72, 1.52, 1.64, 2.07],
    [15975, 14560, 16815, 18065, 17951, 15938, 15324, 15076, 14986, 14909, 15509, 15164, 15500, 16056, 16481, 15749, 15862, 15864, 16456],
    [0.39, 0.40, 0.37, 0.35, 0.44, 0.57, 0.65, 0.82, 0.95, 1.22, 1.30, 1.33, 1.49, 1.53, 1.66, 1.72, 1.52, 1.64, 2.10],
    [15975, 14560, 16815, 18065, 17951, 15938, 15324, 15076, 14986, 14909, 15509, 15164, 15500, 16056, 16481, 15749, 15862, 15864, 16207],
    38)
  }

  document.getElementById("HU").onclick = function () {
    paginaPopup(47.162494, 19.503304, 'Hungary',
    [4.96, 5.69, 7.12, 9.04, 11.44, 14.31, 15.18, 18.80, 21.45, 18.10, 18.51, 20.95, 19.61, 22.08, 55.65, 20.58, 22.11, 23.68, 9.02],
    [9541, 9455, 9513, 9435, 9099, 7900, 7596, 7438, 7366, 7178, 7073, 6719, 6519, 6124, 2517, 5979, 5699, 5901, 15490],
    [4.96, 5.69, 7.12, 9.04, 11.44, 14.31, 15.18, 18.80, 21.45, 18.10, 18.51, 20.95, 19.61, 22.08, 55.65, 20.58, 22.11, 23.68, 23.48],
    [9541, 9455, 9513, 9435, 9099, 7900, 7596, 7438, 7366, 7178, 7073, 6719, 6519, 6124, 2517, 5979, 5699, 5901, 5953],
    120)
  }

  document.getElementById("UY").onclick = function () {
    paginaPopup(-32.522779, -55.765835, 'Uruguay',
    [15.59, 11.16, 6.77, 6.61, 7.21, 8.73, 9.95, 11.14, 14.92, 15.50, 18.73, 19.26, 21.95, 23.79, 23.99, 22.28, 20.88, 22.55, 18.78],
    [1464, 1873, 2009, 1821, 1899, 1990, 1968, 2102, 2035, 2042, 2151, 2490, 2336, 2418, 2386, 2391, 2523, 2505, 2599],
    [15.59, 11.16, 6.77, 6.61, 7.21, 8.73, 9.95, 11.14, 14.92, 15.50, 18.73, 19.26, 21.95, 23.79, 23.99, 22.28, 20.88, 22.55, 20.07],
    [1464, 1873, 2009, 1821, 1899, 1990, 1968, 2102, 2035, 2042, 2151, 2490, 2336, 2418, 2386, 2391, 2523, 2505, 2431],
    109)
  }

  document.getElementById("VA").onclick = function () {
    paginaPopup(41.902916, 12.453389, 'Vatican City', ['nd'], ['nd'],225)
  }

  document.getElementById("UZ").onclick = function () {
    paginaPopup(41.377491, 64.585262, 'Uzbekistan',
    [1.36, 1.07, 0.91, 1.16, 6.40, 1.41, 1.31, 1.71, 2.31, 3.86, 4.62, 5.35, 4.06, 6.09, 8.30, 6.33, 6.32, 4.58, 3.23],
    [10087, 10665, 10496, 8702, 1880, 10142, 13265, 13067, 12817, 8739, 8516, 8589, 12768, 9473, 9208, 12920, 12938, 12930, 15886],
    [1.36, 1.07, 0.91, 1.16, 6.40, 1.41, 1.31, 1.71, 2.31, 3.86, 4.62, 5.35, 4.06, 6.09, 8.30, 6.33, 6.32, 4.58, 3.36],
    [10087, 10665, 10496, 8702, 1880, 10142, 13265, 13067, 12817, 8739, 8516, 8589, 12768, 9473, 9208, 12920, 12938, 12930, 15272],
    154)
  }

  document.getElementById("VU").onclick = function () {
    paginaPopup(-15.376706, 166.95915, 'Vanuatu',
    [1.97, 1.77, 1.76, 2.06, 2.35, 2.47, 2.68, 3.10, 3.49, 3.43, 3.89, 4.33, 4.25, 4.29, 2.78, 3.60, 3.96, 4.51, 3.78],
    [138, 146, 149, 153, 155, 160, 164, 170, 174, 178, 180, 183, 184, 187, 293, 205, 199, 202, 206],
    [1.97, 1.77, 1.76, 2.06, 2.35, 2.47, 2.68, 3.10, 3.49, 3.43, 3.89, 4.33, 4.25, 4.29, 2.78, 3.60, 3.96, 4.51, 3.78],
    [138, 146, 149, 153, 155, 160, 164, 170, 174, 178, 180, 183, 184, 187, 293, 205, 199, 202, 206],
    162)
  }

  document.getElementById("VE").onclick = function () {
    paginaPopup(6.42375, -66.58973, 'Venezuela',
    [5.84, 5.84, 3.96, 3.30, 4.78, 6.33, 7.27, 8.20, 10.53, 11.22, 14.34, 11.60, 12.58, 12.76, 16.37, 12.53, 9.54, 7.71, 1.56],
    [20068, 21036, 23441, 25356, 23517, 22980, 25236, 28088, 30001, 29389, 27427, 27292, 30308, 29069, 29474, 29624, 28893, 30326, 25515],
    [5.84, 5.84, 3.96, 3.30, 4.78, 6.33, 7.27, 8.20, 10.53, 11.22, 14.34, 11.60, 12.58, 12.76, 16.37, 12.53, 9.54, 7.71, 1.63],
    [20068, 21036, 23441, 25356, 23517, 22980, 25236, 28088, 30001, 29389, 27427, 27292, 30308, 29069, 29474, 29624, 28893, 30326, 24494],
    43)
  }

  document.getElementById("VN").onclick = function () {
    paginaPopup(14.058324, 108.277199, 'Vietnam',
    [0.59, 0.62, 0.65, 0.72, 0.81, 1.01, 1.14, 1.30, 1.63, 1.72, 1.88, 2.19, 2.51, 2.74, 2.98, 3.07, 3.24, 3.52, 4.02],
    [52613, 53033, 53656, 54779, 55979, 57097, 58318, 59585, 60727, 61511, 61655, 61840, 61975, 62515, 62441, 62894, 63295, 63559, 61387],
    [0.59, 0.62, 0.65, 0.72, 0.81, 1.01, 1.14, 1.30, 1.63, 1.72, 1.88, 2.19, 2.51, 2.74, 2.98, 3.07, 3.24, 3.52, 4.02],
    [52613, 53033, 53656, 54779, 55979, 57097, 58318, 59585, 60727, 61511, 61655, 61840, 61975, 62515, 62441, 62894, 63295, 63559, 61352],
    91)
  }

  document.getElementById("YE").onclick = function () {
    paginaPopup(15.552727, 48.516388, 'Yemen',
    [0.60, 0.61, 0.65, 0.71, 0.84, 1.02, 1.17, 1.27, 1.59, 1.49, 1.81, 1.77, 1.80, 2.28, 2.12, 1.62, 0.93, 0.78, 0.60],
    [16180, 16190, 16420, 16557, 16508, 16429, 16303, 17029, 16915, 16901, 17070, 18444, 19670, 17719, 20360, 26325, 33406, 34262, 34233],
    [0.60, 0.61, 0.65, 0.71, 0.84, 1.02, 1.17, 1.27, 1.59, 1.49, 1.81, 1.77, 1.80, 2.28, 2.12, 1.62, 0.93, 0.78, 0.61],
    [16180, 16190, 16420, 16557, 16508, 16429, 16303, 17029, 16915, 16901, 17070, 18444, 19670, 17719, 20360, 26325, 33406, 34262, 33622],
    8)
  }

  document.getElementById("ZM").onclick = function () {
    paginaPopup(-13.133897, 27.849332, 'Zambia',
    [0.54, 0.61, 0.69, 0.76, 0.97, 1.27, 1.93, 2.09, 2.62, 2.24, 2.93, 3.28, 3.58, 3.90, 3.76, 2.87, 2.79,3.49, 1.98],
    [6727, 6672, 6377, 6434, 6420, 6584, 6625, 6724, 6832, 6832, 6923, 7157, 7129, 7183, 7223, 7376, 7524, 7404, 8881],
    [0.54, 0.61, 0.69, 0.76, 0.97, 1.27, 1.93, 2.09, 2.62, 2.24, 2.93, 3.28, 3.58, 3.90, 3.76, 2.87, 2.79,3.49, 2.07],
    [6727, 6672, 6377, 6434, 6420, 6584, 6625, 6724, 6832, 6832, 6923, 7157, 7129, 7183, 7223, 7376, 7524, 7404, 8495],
    60)
  }

  document.getElementById("ZW").onclick = function () {
    paginaPopup(-19.015438, 29.154857, 'Zimbabwe',
    [0.65, 0.63, 0.56, 0.49, 0.50, 0.49, 0.46, 0.45, 0.36, 0.82, 1.04, 1.24, 1.56, 1.75, 1.81, 1.87, 1.91, 2.12, 1.30],
    [10326, 10712, 11352, 11588, 11726, 11643, 11792, 11755, 12200, 11804, 11563, 11337, 10958, 10900, 10657, 10681, 10735, 10759, 11757],
    [0.65, 0.63, 0.56, 0.49, 0.50, 0.49, 0.46, 0.45, 0.36, 0.82, 1.04, 1.24, 1.56, 1.75, , 1.87, 1.91, 2.12, 1.34],
    [10326, 10712, 11352, 11588, 11726, 11643, 11792, 11755, 12200, 11804, 11563, 11337, 10958, 10900, 10657, 10681, 10735, 10759, 11397],
    135)
  }

  //_________________________________________________ CHECK _________________________________________________

  var high = document.getElementById('highlight')
      high.style.display = "none"
      document.getElementById('videoUsa').pause();
      document.getElementById('videoSri').pause();
      document.getElementById('videoHaiti').pause();
      document.getElementById('videoLibya').pause();
      document.getElementById('videoSyria').pause();
      document.getElementById('videoIraq').pause();
      document.getElementById('videoUkraine').pause();
      document.getElementById('videoFrance').pause();

      document.getElementById('videoUsa').style.display = 'none';
      document.getElementById('videoSri').style.display = 'none';
      document.getElementById('videoHaiti').style.display = 'none';
      document.getElementById('videoLibya').style.display = 'none';
      document.getElementById('videoSyria').style.display = 'none';
      document.getElementById('videoIraq').style.display = 'none';
      document.getElementById('videoUkraine').style.display = 'none';
      document.getElementById('videoFrance').style.display = 'none';


      // video USA starts

          document.getElementById('check1').onclick = function () {
            document.getElementById('videoNews').style.display = 'block';
            document.getElementById('vUS').style.display = 'block';
            document.getElementById('videoUsa').play();
            document.getElementById('videoSri').pause();
            document.getElementById('videoHaiti').pause();
            document.getElementById('videoLibya').pause();
            document.getElementById('videoSyria').pause();
            document.getElementById('videoIraq').pause();
            document.getElementById('videoUkraine').pause();
            document.getElementById('videoFrance').pause();

            document.getElementById('videoUsa').style.display = 'block';
            document.getElementById('videoSri').style.display = 'none';
            document.getElementById('videoHaiti').style.display = 'none';
            document.getElementById('videoLibya').style.display = 'none';
            document.getElementById('videoSyria').style.display = 'none';
            document.getElementById('videoIraq').style.display = 'none';
            document.getElementById('videoUkraine').style.display = 'none';
            document.getElementById('videoFrance').style.display = 'none';

            notification1.classList.remove(activeClass);
          };

          document.getElementById('videoUsa').onended = function() {
            paginaPopup(37.09024, -95.712891, 'United States',
            [61.86, 60.39, 60.88, 62.80, 65.66, 67.51, 69.08, 71.07, 72.76, 72.98, 74.29, 74.42, 87.07, 78.05, 78.82, 76.51, 92.30, 95.13, 36.41],
            [151268, 160099, 164112, 166857, 170067, 176388, 182314, 185125, 183816, 180171, 183636, 190048, 169273, 195710, 202296, 216689, 184446, 186401, 525727],
            [61.86, 60.39, 60.88, 62.80, 65.66, 67.51, 69.08, 71.07, 72.76, 72.98, 74.29, 74.42, 87.07, 78.05, 78.82, 76.51, 92.30, 95.13, 106.14],
            [151268, 160099, 164112, 166857, 170067, 176388, 182314, 185125, 183816, 180171, 183636, 190048, 169273, 195710, 202296, 216689, 184446, 186401, 180329],
            150)
            chart.options.scales.yAxes[0].ticks.max = Math.round(95.13*1.1);
            chart.options.scales.yAxes[0].ticks.stepSize = Math.round(Math.max(95.13*1.1))/10;
            chart.data.datasets.pointRadius = 50;
            chart.update()
            high.style.display = "block"
            high.style.marginLeft = "62px"
            document.getElementById('videoNews').style.display = 'none';
            document.getElementById('vUS').style.display = 'none';
          };

          document.getElementById('vUS').onclick = function () {
            paginaPopup(37.09024, -95.712891, 'United States',
            [61.86, 60.39, 60.88, 62.80, 65.66, 67.51, 69.08, 71.07, 72.76, 72.98, 74.29, 74.42, 87.07, 78.05, 78.82, 76.51, 92.30, 95.13, 36.41],
            [151268, 160099, 164112, 166857, 170067, 176388, 182314, 185125, 183816, 180171, 183636, 190048, 169273, 195710, 202296, 216689, 184446, 186401, 525727],
            [61.86, 60.39, 60.88, 62.80, 65.66, 67.51, 69.08, 71.07, 72.76, 72.98, 74.29, 74.42, 87.07, 78.05, 78.82, 76.51, 92.30, 95.13, 106.14],
            [151268, 160099, 164112, 166857, 170067, 176388, 182314, 185125, 183816, 180171, 183636, 190048, 169273, 195710, 202296, 216689, 184446, 186401, 180329],
            150)
            notification1.classList.remove(activeClass);
            chart.options.scales.yAxes[0].ticks.max = Math.round(95.13*1.1);
            chart.options.scales.yAxes[0].ticks.stepSize = Math.round(Math.max(95.13*1.1))/10;
            chart.data.datasets.pointRadius = 50;
            chart.update()
            high.style.display = "block"
            high.style.marginLeft = "62px"
            document.getElementById('videoUsa').pause();
            document.getElementById('videoNews').style.display = 'none';
            document.getElementById('vUS').style.display = 'none';
          }

      // video USA ends

      // video Sri Lanka starts

          document.getElementById('check2').onclick = function () {
            document.getElementById('videoNews').style.display = 'block';
            document.getElementById('vSL').style.display = 'block';
            document.getElementById('videoSri').play();
            notification2.classList.remove(activeClass);

            document.getElementById('videoUsa').style.display = 'none';
            document.getElementById('videoSri').style.display = 'block';
            document.getElementById('videoHaiti').style.display = 'none';
            document.getElementById('videoLibya').style.display = 'none';
            document.getElementById('videoSyria').style.display = 'none';
            document.getElementById('videoIraq').style.display = 'none';
            document.getElementById('videoUkraine').style.display = 'none';
            document.getElementById('videoFrance').style.display = 'none';
          };

          document.getElementById('videoSri').onended = function() {
            paginaPopup(7.873054, 80.771797, 'Sri Lanka',
            [0.89, 1.00, 1.12, 1.28, 0.36, 1.34, 1.98, 1.63, 1.56, 1.55, 2.33, 4.26, 4.49, 4.97, 5.17, 5.33, 5.37, 5.64, 5.08],
            [16930, 14268, 13391, 13430, 51385, 16493, 12963, 18050, 23748, 24574, 22069, 13905, 13843, 13523, 13835, 13550, 13570, 13688, 14124],
            [0.89, 1.00, 1.12, 1.28, 0.36, 1.34, 1.98, 1.63, 1.56, 1.55, 2.33, 4.26, 4.49, 4.97, 5.17, 5.33, 5.37, 5.64, 5.15],
            [16930, 14268, 13391, 13430, 51385, 16493, 12963, 18050, 23748, 24574, 22069, 13905, 13843, 13523, 13835, 13550, 13570, 13688, 13920],
            136)
            notification2.classList.remove(activeClass);
            chart.options.scales.yAxes[0].ticks.max = Math.round(5.64*1.1);
            chart.options.scales.yAxes[0].ticks.stepSize = Math.round(Math.max(5.64*1.1))/10;
            chart.data.datasets.pointRadius = 50;
            chart.update()
            high.style.display = "block"
            high.style.marginLeft = "130px"
            document.getElementById('videoNews').style.display = 'none';
            document.getElementById('vSL').style.display = 'none';
          };

          document.getElementById('vSL').onclick = function () {
            paginaPopup(7.873054, 80.771797, 'Sri Lanka',
            [0.89, 1.00, 1.12, 1.28, 0.36, 1.34, 1.98, 1.63, 1.56, 1.55, 2.33, 4.26, 4.49, 4.97, 5.17, 5.33, 5.37, 5.64, 5.08],
            [16930, 14268, 13391, 13430, 51385, 16493, 12963, 18050, 23748, 24574, 22069, 13905, 13843, 13523, 13835, 13550, 13570, 13688, 14124],
            [0.89, 1.00, 1.12, 1.28, 0.36, 1.34, 1.98, 1.63, 1.56, 1.55, 2.33, 4.26, 4.49, 4.97, 5.17, 5.33, 5.37, 5.64, 5.15],
            [16930, 14268, 13391, 13430, 51385, 16493, 12963, 18050, 23748, 24574, 22069, 13905, 13843, 13523, 13835, 13550, 13570, 13688, 13920],
            136)
            notification2.classList.remove(activeClass);
            chart.options.scales.yAxes[0].ticks.max = Math.round(5.64*1.1);
            chart.options.scales.yAxes[0].ticks.stepSize = Math.round(Math.max(5.64*1.1))/10;
            chart.data.datasets.pointRadius = 50;
            chart.update()
            high.style.display = "block"
            high.style.marginLeft = "130px"
            document.getElementById('videoSri').pause();
            document.getElementById('videoNews').style.display = 'none';
            document.getElementById('vSL').style.display = 'none';
          }

      // video Sri Lanka ends


      // video Haiti starts

          document.getElementById('check3').onclick = function () {
            document.getElementById('videoNews').style.display = 'block';
            document.getElementById('vH').style.display = 'block';
            document.getElementById('videoHaiti').play();
            notification3.classList.remove(activeClass);

            document.getElementById('videoUsa').style.display = 'none';
            document.getElementById('videoSri').style.display = 'none';
            document.getElementById('videoHaiti').style.display = 'block';
            document.getElementById('videoLibya').style.display = 'none';
            document.getElementById('videoSyria').style.display = 'none';
            document.getElementById('videoIraq').style.display = 'none';
            document.getElementById('videoUkraine').style.display = 'none';
            document.getElementById('videoFrance').style.display = 'none';
          };

          document.getElementById('videoHaiti').onended = function() {
            paginaPopup(18.971187, -72.285215, 'Haiti',
            [0.36, 0.33, 0.32, 0.27, 0.25, 0.38, 0.42, 0.50, 0.52, 0.56, 0.03, 0.64, 0.66, 0.71, 0.73, 0.73, 0.63, 0.69, 1.09],
            [9939, 9937, 9926, 10077, 12923, 10268, 10410, 10614, 11416, 10789, 233397, 10740, 10852, 10830, 10981, 10911, 11497, 11068, 11170],
            [0.36, 0.33, 0.32, 0.27, 0.25, 0.38, 0.42, 0.50, 0.52, 0.56, 0.03, 0.64, 0.66, 0.71, 0.73, 0.73, 0.63, 0.69, 1.12],
            [9939, 9937, 9926, 10077, 12923, 10268, 10410, 10614, 11416, 10789, 233397, 10740, 10852, 10830, 10981, 10911, 11497, 11068, 10934],
            93)
            notification3.classList.remove(activeClass);
            chart.options.scales.yAxes[0].ticks.max = Math.round(0.73*1.1);
            chart.options.scales.yAxes[0].ticks.stepSize = Math.round(Math.max(0.73*1.1))/10;
            chart.update()
            high.style.display = "block"
            high.style.marginLeft = "293px"
            document.getElementById('videoNews').style.display = 'none';
            document.getElementById('vH').style.display = 'none';

          };

          document.getElementById('vH').onclick = function () {
            paginaPopup(18.971187, -72.285215, 'Haiti',
            [0.36, 0.33, 0.32, 0.27, 0.25, 0.38, 0.42, 0.50, 0.52, 0.56, 0.03, 0.64, 0.66, 0.71, 0.73, 0.73, 0.63, 0.69, 1.09],
            [9939, 9937, 9926, 10077, 12923, 10268, 10410, 10614, 11416, 10789, 233397, 10740, 10852, 10830, 10981, 10911, 11497, 11068, 11170],
            [0.36, 0.33, 0.32, 0.27, 0.25, 0.38, 0.42, 0.50, 0.52, 0.56, 0.03, 0.64, 0.66, 0.71, 0.73, 0.73, 0.63, 0.69, 1.12],
            [9939, 9937, 9926, 10077, 12923, 10268, 10410, 10614, 11416, 10789, 233397, 10740, 10852, 10830, 10981, 10911, 11497, 11068, 10934],
            93)
            notification3.classList.remove(activeClass);
            chart.options.scales.yAxes[0].ticks.max = Math.round(0.73*1.1);
            chart.options.scales.yAxes[0].ticks.stepSize = Math.round(Math.max(0.73*1.1))/10;
            chart.update()
            high.style.display = "block"
            high.style.marginLeft = "293px"
            document.getElementById('videoHaiti').pause();
            document.getElementById('videoNews').style.display = 'none';
            document.getElementById('vH').style.display = 'none';
          }

      // video Haiti ends

      // video Libya starts

          document.getElementById('check4').onclick = function () {
            document.getElementById('videoNews').style.display = 'block';
            document.getElementById('vL').style.display = 'block';
            document.getElementById('videoLibya').play();
            notification4.classList.remove(activeClass);

            document.getElementById('videoUsa').style.display = 'none';
            document.getElementById('videoSri').style.display = 'none';
            document.getElementById('videoHaiti').style.display = 'none';
            document.getElementById('videoLibya').style.display = 'block';
            document.getElementById('videoSyria').style.display = 'none';
            document.getElementById('videoIraq').style.display = 'none';
            document.getElementById('videoUkraine').style.display = 'none';
            document.getElementById('videoFrance').style.display = 'none';
          };

          document.getElementById('videoLibya').onended = function() {
            paginaPopup(26.3351, 17.228331, 'Libya',
            [9.34, 9.57, 9.44, 9.95, 9.79, 13.44, 17.26, 20.95, 21.57, 19.79, 20.41, 0.51, 14.49, 15.56, 5.92, 6.20, 3.78, 5.58, 3.65],
            [2708, 2681, 2754, 2650, 2728, 2693, 2668, 2699, 3117, 3409, 3420, 51420, 4557, 3973, 7435, 5354, 7112, 5710, 6344],
            [9.34, 9.57, 9.44, 9.95, 9.79, 13.44, 17.26, 20.95, 21.57, 19.79, 20.41, 0.51, 14.49, 15.56, 5.92, 6.20, 3.78, 5.58, 4.73],
            [2708, 2681, 2754, 2650, 2728, 2693, 2668, 2699, 3117, 3409, 3420, 51420, 4557, 3973, 7435, 5354, 7112, 5710, 4885],
            4)
            notification4.classList.remove(activeClass);
            chart.options.scales.yAxes[0].ticks.max = Math.round(21.57*1.1);
            chart.options.scales.yAxes[0].ticks.stepSize = Math.round(Math.max(21.57*1.1))/10;
            chart.update()
            high.style.display = "block";
            high.style.marginLeft = "323px";
            document.getElementById('videoNews').style.display = 'none';
            document.getElementById('vL').style.display = 'none';
          };

          document.getElementById('vL').onclick = function () {
            paginaPopup(26.3351, 17.228331, 'Libya',
            [9.34, 9.57, 9.44, 9.95, 9.79, 13.44, 17.26, 20.95, 21.57, 19.79, 20.41, 0.51, 14.49, 15.56, 5.92, 6.20, 3.78, 5.58, 3.65],
            [2708, 2681, 2754, 2650, 2728, 2693, 2668, 2699, 3117, 3409, 3420, 51420, 4557, 3973, 7435, 5354, 7112, 5710, 6344],
            [9.34, 9.57, 9.44, 9.95, 9.79, 13.44, 17.26, 20.95, 21.57, 19.79, 20.41, 0.51, 14.49, 15.56, 5.92, 6.20, 3.78, 5.58, 4.73],
            [2708, 2681, 2754, 2650, 2728, 2693, 2668, 2699, 3117, 3409, 3420, 51420, 4557, 3973, 7435, 5354, 7112, 5710, 4885],
            4)
            notification4.classList.remove(activeClass);
            chart.options.scales.yAxes[0].ticks.max = Math.round(21.57*1.1);
            chart.options.scales.yAxes[0].ticks.stepSize = Math.round(Math.max(21.57*1.1))/10;
            chart.update()
            high.style.display = "block";
            high.style.marginLeft = "323px";
            document.getElementById('videoLibya').pause();
            document.getElementById('videoNews').style.display = 'none';
            document.getElementById('vL').style.display = 'none';
          }

      // video Libya ends

      // video Syria starts

        document.getElementById('check5').onclick = function () {
          document.getElementById('videoNews').style.display = 'block';
          document.getElementById('vS').style.display = 'block';
          document.getElementById('videoSyria').play();
          notification5.classList.remove(activeClass);

          document.getElementById('videoUsa').style.display = 'none';
          document.getElementById('videoSri').style.display = 'none';
          document.getElementById('videoHaiti').style.display = 'none';
          document.getElementById('videoLibya').style.display = 'none';
          document.getElementById('videoSyria').style.display = 'block';
          document.getElementById('videoIraq').style.display = 'none';
          document.getElementById('videoUkraine').style.display = 'none';
          document.getElementById('videoFrance').style.display = 'none';
        };

        document.getElementById('videoSyria').onended = function() {
          paginaPopup(34.802075, 38.996815, 'Syria',
          [3.72, 4.14, 4.05, 4.56, 9.06, 8.82, 9.28, 10.85, 11.10, 15.47, 17.75, 3.80, 1.02, 0.45, 0.27, 0.29, 0.19, 0.30, 3.83],
          [4695, 4606, 4809, 4316, 2491, 2931, 3202, 3302, 3689, 3206, 3102, 16096, 65407, 55005, 78709, 59923, 59886, 45412, 11657],
          [3.72, 4.14, 4.05, 4.56, 9.06, 8.82, 9.28, 10.85, 11.10, 15.47, 17.75, 3.80, 1.02, 0.45, 0.27, 0.29, 0.19, 0.30, 4.08],
          [4695, 4606, 4809, 4316, 2491, 2931, 3202, 3302, 3689, 3206, 3102, 16096, 65407, 55005, 78709, 59923, 59886, 45412, 10953],
          71)
          notification5.classList.remove(activeClass);
          chart.options.scales.yAxes[0].ticks.max = Math.round(17.75*1.1);
          chart.options.scales.yAxes[0].ticks.stepSize = Math.round(Math.max(17.75*1.1))/10;
          document.getElementById('videoNews').style.display = 'none';
          chart.update();
          high.style.display = "block";
          high.style.marginLeft = "349px";
          document.getElementById('videoNews').style.display = 'none';
          document.getElementById('vS').style.display = 'none';
        };

        document.getElementById('vS').onclick = function () {
          paginaPopup(34.802075, 38.996815, 'Syria',
          [3.72, 4.14, 4.05, 4.56, 9.06, 8.82, 9.28, 10.85, 11.10, 15.47, 17.75, 3.80, 1.02, 0.45, 0.27, 0.29, 0.19, 0.30, 3.83],
          [4695, 4606, 4809, 4316, 2491, 2931, 3202, 3302, 3689, 3206, 3102, 16096, 65407, 55005, 78709, 59923, 59886, 45412, 11657],
          [3.72, 4.14, 4.05, 4.56, 9.06, 8.82, 9.28, 10.85, 11.10, 15.47, 17.75, 3.80, 1.02, 0.45, 0.27, 0.29, 0.19, 0.30, 4.08],
          [4695, 4606, 4809, 4316, 2491, 2931, 3202, 3302, 3689, 3206, 3102, 16096, 65407, 55005, 78709, 59923, 59886, 45412, 10953],
          71)
          notification5.classList.remove(activeClass);
          chart.options.scales.yAxes[0].ticks.max = Math.round(17.75*1.1);
          chart.options.scales.yAxes[0].ticks.stepSize = Math.round(Math.max(17.75*1.1))/10;
          chart.update();
          high.style.display = "block";
          high.style.marginLeft = "349px";
          document.getElementById('videoSyria').pause();
          document.getElementById('videoNews').style.display = 'none';
          document.getElementById('vS').style.display = 'none';

        }

      // video Syria ends

      // video Iraq starts

        document.getElementById('check6').onclick = function () {
          document.getElementById('videoNews').style.display = 'block';
          document.getElementById('vI').style.display = 'block';
          document.getElementById('videoIraq').play();
          notification6.classList.remove(activeClass);

          document.getElementById('videoUsa').style.display = 'none';
          document.getElementById('videoSri').style.display = 'none';
          document.getElementById('videoHaiti').style.display = 'none';
          document.getElementById('videoLibya').style.display = 'none';
          document.getElementById('videoSyria').style.display = 'none';
          document.getElementById('videoIraq').style.display = 'block';
          document.getElementById('videoUkraine').style.display = 'none';
          document.getElementById('videoFrance').style.display = 'none';
        };

        document.getElementById('videoIraq').onended = function() {
          paginaPopup(33.223191, 43.679291, 'Iraq',
          [1.13, 0.86, 0.82, 0.66, 1.46, 1.84, 1.39, 1.82, 4.39, 4.25, 7.52, 7.15, 8.04, 6.28, 4.29, 3.92, 3.60, 3.75, 3.89],
          [20803, 20114, 21007, 21392, 22909, 24772, 42534, 44572, 27359, 23996, 24392, 23756, 24801, 34208, 50127, 42089, 43691, 48501, 39162],
          [1.13, 0.86, 0.82, 0.66, 1.46, 1.84, 1.39, 1.82, 4.39, 4.25, 7.52, 7.15, 8.04, 6.28, 4.29, 3.92, 3.60, 3.75, 5.77],
          [20803, 20114, 21007, 21392, 22909, 24772, 42534, 44572, 27359, 23996, 24392, 23756, 24801, 34208, 50127, 42089, 43691, 48501, 26354],
          53)
          notification6.classList.remove(activeClass);
          chart.options.scales.yAxes[0].ticks.max = Math.round(8.04*1.1);
          chart.options.scales.yAxes[0].ticks.stepSize = Math.round(Math.max(8.04*1.1))/10;
          chart.update();
          high.style.display = "block";
          high.style.marginLeft = "401px";
          document.getElementById('videoNews').style.display = 'none';
          document.getElementById('vI').style.display = 'none';
        };

        document.getElementById('vI').onclick = function () {
          paginaPopup(33.223191, 43.679291, 'Iraq',
          [1.13, 0.86, 0.82, 0.66, 1.46, 1.84, 1.39, 1.82, 4.39, 4.25, 7.52, 7.15, 8.04, 6.28, 4.29, 3.92, 3.60, 3.75, 3.89],
          [20803, 20114, 21007, 21392, 22909, 24772, 42534, 44572, 27359, 23996, 24392, 23756, 24801, 34208, 50127, 42089, 43691, 48501, 39162],
          [1.13, 0.86, 0.82, 0.66, 1.46, 1.84, 1.39, 1.82, 4.39, 4.25, 7.52, 7.15, 8.04, 6.28, 4.29, 3.92, 3.60, 3.75, 5.77],
          [20803, 20114, 21007, 21392, 22909, 24772, 42534, 44572, 27359, 23996, 24392, 23756, 24801, 34208, 50127, 42089, 43691, 48501, 26354],
          53)
          notification6.classList.remove(activeClass);
          chart.options.scales.yAxes[0].ticks.max = Math.round(8.04*1.1);
          chart.options.scales.yAxes[0].ticks.stepSize = Math.round(Math.max(8.04*1.1))/10;
          chart.update();
          high.style.display = "block";
          high.style.marginLeft = "401px";
          document.getElementById('videoIraq').pause();
          document.getElementById('videoNews').style.display = 'none';
          document.getElementById('vI').style.display = 'none';
        }

      // video Iraq ends

      // video Ukraine starts

        document.getElementById('check7').onclick = function () {
          document.getElementById('videoNews').style.display = 'block';
          document.getElementById('vUK').style.display = 'block';
          document.getElementById('videoUkraine').play();
          notification7.classList.remove(activeClass);

          document.getElementById('videoUsa').style.display = 'none';
          document.getElementById('videoSri').style.display = 'none';
          document.getElementById('videoHaiti').style.display = 'none';
          document.getElementById('videoLibya').style.display = 'none';
          document.getElementById('videoSyria').style.display = 'none';
          document.getElementById('videoIraq').style.display = 'none';
          document.getElementById('videoUkraine').style.display = 'block';
          document.getElementById('videoFrance').style.display = 'none';
        };

        document.getElementById('videoUkraine').onended = function() {
          paginaPopup(48.379433, 31.16558, 'Ukraine',
          [0.42, 0.50, 0.55, 0.69, 0.91, 1.23, 1.67, 2.16, 2.93, 2.39, 3.09, 3.85, 4.21, 5.10, 3.50, 2.78, 2.15, 2.65, 2.37],
          [73575, 75321, 76311, 72576, 71229, 69954, 64556, 65978, 61377, 48936, 43955, 42380, 41713, 35947, 40135, 34569, 45689, 44736, 62468],
          [0.42, 0.50, 0.55, 0.69, 0.91, 1.23, 1.67, 2.16, 2.93, 2.39, 3.09, 3.85, 4.21, 5.10, 3.50, 2.78, 2.15, 2.65, 3.38],
          [73575, 75321, 76311, 72576, 71229, 69954, 64556, 65978, 61377, 48936, 43955, 42380, 41713, 35947, 40135, 34569, 45689, 44736, 43935],
          17)
          notification7.classList.remove(activeClass);
          chart.options.scales.yAxes[0].ticks.max = Math.round(5.1*1.1);
          chart.options.scales.yAxes[0].ticks.stepSize = Math.round(Math.max(5.1*1.1))/10;
          chart.update();
          high.style.display = "block";
          high.style.marginLeft = "428px";
          document.getElementById('videoNews').style.display = 'none';
          document.getElementById('vUK').style.display = 'none';
        };

        document.getElementById('vUK').onclick = function () {
          paginaPopup(48.379433, 31.16558, 'Ukraine',
          [0.42, 0.50, 0.55, 0.69, 0.91, 1.23, 1.67, 2.16, 2.93, 2.39, 3.09, 3.85, 4.21, 5.10, 3.50, 2.78, 2.15, 2.65, 2.37],
          [73575, 75321, 76311, 72576, 71229, 69954, 64556, 65978, 61377, 48936, 43955, 42380, 41713, 35947, 40135, 34569, 45689, 44736, 62468],
          [0.42, 0.50, 0.55, 0.69, 0.91, 1.23, 1.67, 2.16, 2.93, 2.39, 3.09, 3.85, 4.21, 5.10, 3.50, 2.78, 2.15, 2.65, 3.38],
          [73575, 75321, 76311, 72576, 71229, 69954, 64556, 65978, 61377, 48936, 43955, 42380, 41713, 35947, 40135, 34569, 45689, 44736, 43935],
          17)
          notification7.classList.remove(activeClass);
          chart.options.scales.yAxes[0].ticks.max = Math.round(5.1*1.1);
          chart.options.scales.yAxes[0].ticks.stepSize = Math.round(Math.max(5.1*1.1))/10;
          chart.update();
          high.style.display = "block";
          high.style.marginLeft = "428px";
          document.getElementById('videoUkraine').pause();
          document.getElementById('videoNews').style.display = 'none';
          document.getElementById('vUK').style.display = 'none';
        }

      // video Ukraine ends

      // video France starts

        document.getElementById('check8').onclick = function () {
          document.getElementById('videoNews').style.display = 'block';
          document.getElementById('vF').style.display = 'block';
          document.getElementById('videoFrance').play();
          notification8.classList.remove(activeClass);

          document.getElementById('videoUsa').style.display = 'none';
          document.getElementById('videoSri').style.display = 'none';
          document.getElementById('videoHaiti').style.display = 'none';
          document.getElementById('videoLibya').style.display = 'none';
          document.getElementById('videoSyria').style.display = 'none';
          document.getElementById('videoIraq').style.display = 'none';
          document.getElementById('videoUkraine').style.display = 'none';
          document.getElementById('videoFrance').style.display = 'block';
        };

        document.getElementById('videoFrance').onended = function() {
          paginaPopup(46.227638, 2.213749, 'France',
          [29.09, 29.52, 32.24, 38.93, 49.79, 51.10, 55.27, 63.70, 69.21, 62.76, 61.42, 67.54, 63.90, 68.73, 71.27, 64.64, 53.72, 55.85, 20.84],
          [41436, 41066, 40888, 41674, 37431, 37808, 36867, 36645, 37038, 37661, 37805, 37229, 36900, 35909, 35116, 40564, 40282, 40602, 110114],
          [29.09, 29.52, 32.24, 38.93, 49.79, 51.10, 55.27, 63.70, 69.21, 62.76, 61.42, 67.54, 63.90, 68.73, 71.27, 64.64, 53.72, 55.85, 49.76],
          [41436, 41066, 40888, 41674, 37431, 37808, 36867, 36645, 37038, 37661, 37805, 37229, 36900, 35909, 35116, 40564, 40282, 40602, 46110],
          3)
          notification8.classList.remove(activeClass);
          chart.options.scales.yAxes[0].ticks.max = Math.round(71.27*1.1);
          chart.options.scales.yAxes[0].ticks.stepSize = Math.round(Math.max(71.27*1.1))/10;
          chart.update();
          high.style.display = "block"
          high.style.marginLeft = "457px"
          document.getElementById('videoNews').style.display = 'none';
          document.getElementById('vF').style.display = 'none';
        };

        document.getElementById('vF').onclick = function () {
          paginaPopup(46.227638, 2.213749, 'France',
          [29.09, 29.52, 32.24, 38.93, 49.79, 51.10, 55.27, 63.70, 69.21, 62.76, 61.42, 67.54, 63.90, 68.73, 71.27, 64.64, 53.72, 55.85, 20.84],
          [41436, 41066, 40888, 41674, 37431, 37808, 36867, 36645, 37038, 37661, 37805, 37229, 36900, 35909, 35116, 40564, 40282, 40602, 110114],
          [29.09, 29.52, 32.24, 38.93, 49.79, 51.10, 55.27, 63.70, 69.21, 62.76, 61.42, 67.54, 63.90, 68.73, 71.27, 64.64, 53.72, 55.85, 49.76],
          [41436, 41066, 40888, 41674, 37431, 37808, 36867, 36645, 37038, 37661, 37805, 37229, 36900, 35909, 35116, 40564, 40282, 40602, 46110],
          3)
          notification8.classList.remove(activeClass);
          chart.options.scales.yAxes[0].ticks.max = Math.round(71.27*1.1);
          chart.options.scales.yAxes[0].ticks.stepSize = Math.round(Math.max(71.27*1.1))/10;
          chart.update();
          high.style.display = "block"
          high.style.marginLeft = "457px"
          document.getElementById('videoFrance').pause();
          document.getElementById('videoNews').style.display = 'none';
          document.getElementById('vF').style.display = 'none';
        }

      // video France ends



  function render() {

    zoom(curZoomSpeed);

    rotation.x += (target.x - rotation.x) * 0.1;
    rotation.y += (target.y - rotation.y) * 0.1;
    distance += (distanceTarget - distance) * 0.3;

    camera.position.x = distance * Math.sin(rotation.x) * Math.cos(rotation.y);
    camera.position.y = distance * Math.sin(rotation.y);
    camera.position.z = distance * Math.cos(rotation.x) * Math.cos(rotation.y);

    camera.lookAt(mesh.position);

	renderer.render( scene, camera )
  }

  init();
  this.animate = animate;


  this.__defineGetter__('time', function() {
    return this._time || 0;
  });

  this.__defineSetter__('time', function(t) {
    var validMorphs = ['nd'];
    var morphDict = this.points.morphTargetDictionary;
    for (var k in morphDict) {
      if (k.indexOf('morphPadding') < 0) {
        validMorphs.push(morphDict[k]);
      }
    }
    validMorphs.sort();
    var l = validMorphs.length - 1;
    var scaledt = t * l + 1;
    var index = Math.floor(scaledt);
    for (i = 0; i < validMorphs.length; i++) {
      this.points.morphTargetInfluences[validMorphs[i]] = 0;
    }
    var lastIndex = index - 1;
    var leftover = scaledt - index;
    if (lastIndex >= 0) {
      this.points.morphTargetInfluences[lastIndex] = 1 - leftover;
    }
    this.points.morphTargetInfluences[index] = leftover;
    this._time = t;
  });

  this.addData = addData;
  this.createPoints = createPoints;
  this.renderer = renderer;
  this.scene = scene;

  return this;

};
