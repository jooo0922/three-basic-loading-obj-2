'use strict';

import * as THREE from 'https://threejsfundamentals.org/threejs/resources/threejs/r127/build/three.module.js';

import {
  OrbitControls
} from 'https://threejsfundamentals.org/threejs/resources/threejs/r127/examples/jsm/controls/OrbitControls.js';

import {
  OBJLoader
} from 'https://threejsfundamentals.org/threejs/resources/threejs/r127/examples/jsm/loaders/OBJLoader.js';

import {
  MTLLoader
} from 'https://threejsfundamentals.org/threejs/resources/threejs/r127/examples/jsm/loaders/MTLLoader.js';

function main() {
  // create WebGLRenderer
  const canvas = document.querySelector('#canvas');
  const renderer = new THREE.WebGLRenderer({
    canvas
  });

  // create camera
  const fov = 45;
  const aspect = 2;
  const near = 0.1;
  const far = 100;
  const camera = new THREE.PerspectiveCamera(fov, aspect, near, far);
  camera.position.set(0, 10, 20);

  // create OrbitControls
  const controls = new OrbitControls(camera, canvas);
  controls.target.set(0, 5, 0); // OrbitControls로 컨트롤하는 카메라의 시선이 (0, 5, 0)지점에 고정될거임
  controls.update();

  // create scene
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('black');

  // 평면 지오메트리를 만들어서 바닥 역할을 할 메쉬를 생성해 줌.
  {
    // 풍차의 boxSize가 2000이 넘기 때문에, 바닥 메쉬의 사이즈도 4000 정도로 크게 해줘야 됨
    const planeSize = 4000;

    // 텍스처를 로드하고 생성함
    const loader = new THREE.TextureLoader();
    const texture = loader.load('./image/checker.png');
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping; // 텍스쳐의 수평, 수직 방향의 래핑 유형을 '반복'으로 지정함.
    texture.magFilter = THREE.NearestFilter;
    const repeats = planeSize / 200; // 바닥 메쉬의 크기가 늘어났으니 반복 횟수도 그에 맞춰 늘어나야겠지
    texture.repeat.set(repeats, repeats); // 수평, 수직 방향의 반복횟수를 각각 20회로 지정함. 왜? 원본의 가로세로가 2*2인데 생성할 메쉬의 사이즈가 40*40이니까 가로, 세로방향으로 각각 20번 반복해서 들어가면 딱 맞지

    // 평면 지오메트리를 생성하고 바닥 메쉬를 만듦
    const planeGeo = new THREE.PlaneGeometry(planeSize, planeSize);
    const planeMat = new THREE.MeshPhongMaterial({
      map: texture,
      side: THREE.DoubleSide, // 바닥 메쉬의 양면을 모두 렌더링처리 하도록 지정함.
    });
    const mesh = new THREE.Mesh(planeGeo, planeMat);
    mesh.rotation.x = Math.PI * -0.5; // 메쉬는 항상 XY축을 기준으로 생성되므로 XZ축을 기준으로 생성하려면 메쉬를 X축을 기준으로 -90도 회전시켜야 함.
    scene.add(mesh);
  }

  // HemisphereLight(반구광) 생성
  {
    const skyColor = 0xB1E1FF; // light blue
    const groundColor = 0xB97A20 // brownish orange
    const intensity = 1;
    const light = new THREE.HemisphereLight(skyColor, groundColor, intensity);
    scene.add(light);
  }

  // DirectionalLight(직사광) 생성
  {
    const color = 0xFFFFFF;
    const intensity = 1;
    const light = new THREE.DirectionalLight(color, intensity);
    light.position.set(0, 10, 0);
    light.target.position.set(-5, 0, 0);
    scene.add(light);
    scene.add(light.target); // 직사광같은 경우, light.target을 설정해줬으면 target도 따로 scene에 추가해줘야 함.
  }

  /**
   * 직각삼각형에서 tan(angle) = 높이 / 밑변 공식을 활용해서 
   * 밑변 = 높이 / tan(angle)로 육면체가 카메라의 절두체 안으로 들어올 수 있는 육면체 ~ 카메라 사이의 거리값을 구할 수 있음.
   * 자세한 공식 유도 과정은 튜토리얼 웹사이트 참고.
   * 
   * 이 거리를 구할 때 bounding box의 크기(boxSize)와 중심점(boxCenter)을 넘겨줘서 구하는 함수를 만든 것.
   */
  function frameArea(sizeToFitOnScreen, boxSize, boxCenter, camera) {
    const halfSizeToFitOnScreen = sizeToFitOnScreen * 0.5; // 카메라 절두체 화면크기의 절반값. 직각삼각형에서 높이에 해당.
    const halfFovY = THREE.MathUtils.degToRad(camera.fov * 0.5); // 현재 카메라의 시야각(fov)값의 절반값. tan() 메서드에 할당할 각도값. fov는 항상 degree 단위로 계산되기 때문에 tan 메서드에 넣어주려면 radian 단위로 변환해줘야 함.
    const distance = halfSizeToFitOnScreen / Math.tan(halfFovY); // 카메라와 육면체 사이의 거리값. 탄젠트값으로 직각삼각형의 밑변의 길이를 구하는 공식을 정리한 것. 

    /**
     * Vector3.subVector(camera.position.boxCenter)
     * 얘는 뭐냐면, 카메라 위치 좌표값 - bounding box 중심점 좌표값 이렇게 벡터의 차로 뺸 값으로, 카메라 위치 ~ bounding box 중심점으로 향하는 벡터를 구하는거임. 
     * 
     * Vector3.subVectors(camera.position.boxCenter).normalize()
     * 얘는 뭐냐면, 카메라 위치 ~ bounding box 중심점으로 향하는 벡터를 '단위벡터화' 시키는거임.
     * 그니까 방향은 같은데, 길이값이 1인 '방향값만 갖는 벡터'로 만든다는 거지.
     * 왜? 이 방향벡터(단위벡터)에 위에서 구한 distance값(거리값이므로 스칼라값이지?)을 곱해주면 bounding box의 중심점에서 카메라 위치까지의 벡터를 distance값에 따라 다시 구해줄 수 있기 때문임.
     * 
     * 근데 그냥
     * const direction = (new THREE.Vector3()).subVectors(camera.position, boxCenter).normalize();
     * 이렇게 단위벡터를 구해주면, 카메라가 풍차의 아랫부분에서 풍차를 찍어줌
     * boxCenter값이 대략 (0, 770, 0), camera.position의 초기값이 (0, 10, 20)이니까
     * boxCenter가 너무 위쪽에 자리잡고 있는거임. 그니까 단위벡터의 방향도 위쪽으로 향하게 되는거지.
     * 
     * 그래서 .multiply(new THREE.Vector(1, 0, 1))을 곱해줘서 방향벡터로 변환하기 전 y값만 아예 0으로 만들어버려서
     * 방향벡터가 항상 XZ면에 평행하게 만들어버려야 됨. 그래야 벡터가 위로, 그니까 y축으로 향하지 않겠지.
     */
    const direction = (new THREE.Vector3()).subVectors(camera.position, boxCenter).multiply(new THREE.Vector3(1, 0, 1)).normalize();

    // 방향벡터에 distance를 곱해서 bounding box의 중심점에서 카메라 위치까지의 벡터값을 구한 뒤,
    // 이 벡터는 길이와 방향값을 갖는 벡터니까, bounding box의 중심점에서 해당 벡터값을 더해주면 distance만큼 떨어지고, 방향벡터의 방향으로 떨어진 카메라의 위치값이 나오겠지?
    // 이 위치값을 복사해서 camera.position에 그대로 할당해주라는 뜻. 원래는 Vector3.copy(Vector3)에 사용되는 메서드인데, camera가 됬든 뭐가 됬든 Object3D.position은 다 Vector3로 보면 됨.
    camera.position.copy(direction.multiplyScalar(distance).add(boxCenter));

    // 절두체의 near를 boxSize 길이의 0.01배, far를 boxSize 길이의 100배로 지정해주면, 해당 절두체 안에 bounding box가 충분히 들어가고도 남을 사이즈가 되겠지
    camera.near = boxSize / 100;
    camera.far = boxSize * 100;

    // 카메라의 near, far값을 바꿔줬으니 업데이트 메서드를 호출해줘야 함
    camera.updateProjectionMatrix();

    // 카메라가 bounding box의 중심점을 바라보도록 해야 함.
    camera.lookAt(boxCenter.x, boxCenter.y, boxCenter.z);
  }

  // MTLLoader를 생성해서 먼저 mtl 파일을 로드한 뒤, 로드가 끝나면 OBJLoader를 생성해서 obj 파일을 로드하여 mtl을 적용시키고, 로드된 obj를 씬에 추가함. 
  {
    const mtlLoader = new MTLLoader();
    mtlLoader.load('https://threejsfundamentals.org/threejs/resources/models/windmill_2/windmill-fixed.mtl', (mtl) => {
      mtl.preload();

      const objLoader = new OBJLoader();
      objLoader.setMaterials(mtl);
      objLoader.load('https://threejsfundamentals.org/threejs/resources/models/windmill_2/windmill.obj', (root) => {
        scene.add(root);

        // 이렇게 로드한 뒤에 바로 씬에 추가하면 모델이 안보인다. 모델의 크기 때문인지 알아봐야 함.
        // three.js가 방금 불러온 Object3D 모델을 감싸는 육면체를 계산해서 모델의 크기와 중심점을 구함.
        /**
         * Three.Box3()
         * 3D 공간상의 축 정렬 bounding box를 나타내주는 객체
         * 
         * -Three.Box3.setFromObject(Object3D): 얘는 인자로 전달한 Object3D 객체의 3차원 공간상의 bounding box를 계산해 줌.
         * -Three.Box3.getSize(Vector3): 얘는 인자로 전달한 Vector3에 bounding box의 width, height, depth값을 반환하여 복사해 줌.
         * -Three.Box3.getCenter(Vector3): 얘는 bounding box의 가운데 좌표값을 구해서 인자로 전달한 Vector3에 복사하여 리턴해 줌.
         * 
         * -Vector3.length(): 얘는 (0, 0, 0)에서부터 Vector3에 담긴 좌표값 (x, y, z)까지의 '유클리드 길이(직선 길이)'를 계산해 줌.
         * 한마디로, (0, 0, 0) ~ (width, height, depth)까지의 직선 거리, 즉 벡터의 길이를 계산해준다는 뜻. 왜 이게 필요할까?
         * 이거는 달리 생각해보면 width, height, depth 만큼의 크기를 가지는 bounding box를 대각선으로 가로지르는 선의 길이를 구하는 것과 같음.
         * 이 길이값을 알 수 있다면 대략 박스가 아 이 정도 크기가 되는구나 라고 가늠할 수 있음. 상자의 '부피'를 구하는 게 아니라 상자를 '가로지르는 직선'을 구하는거임!
         * 이 값이 좀 더 상자의 크기를 직관적으로 가늠할 수 있으니까! 이 상자가 절두체안에 들어오려면 카메라 값을 얼마 정도로 설정해줘야 할 지도 직관적으로 가늠이 되니까!
         */
        const box = new THREE.Box3().setFromObject(root);
        const boxSize = box.getSize(new THREE.Vector3()).length(); // 이 값이 대략 2123.649... 정도인데 카메라 절두체의 near는 0.1, far는 100, 바닥 메쉬의 사이즈는 40 * 40이니까 택도 없는거지. 너무 커서 카메라를 벗어나는 상황임.
        const boxCenter = box.getCenter(new THREE.Vector3()); // 이 값이 대략 (0, 770, 0)

        // 사실 frameArea 함수에 들어가는 sizeToFitOnScreen 인자에는 bounding box의 높이값을 전달해줘야 하는 게 아닌가? 라고 생각할 수 있음. 왜냐면 직각삼각형의 높이의 절반이 될 값을 전달해주는거니까
        // 그런데 상식적으로 생각해보면, bounding box의 높이값을 화면 크기로 갖는 절두체가 만들어진다고 가정하면, bounding box가 그 절두체에 다 들어가지 못하고 짤리는 부분이 반드시 생기게 되어있음.
        // 그래서 bounding box의 높이값보다 더 길고 여유있는 boxSize(육면체의 대각선 길이)가 들어가야 하는데, 그것도 좀 육면체가 절두체에 꽉 차게 될 것 같으니 1.2를 곱해줘서 전달하는거임.
        // 이 정도로 절두체의 화면크기값을 전달해줘야 절두체가 육면체를 넉넉하게 품을 수 있음.
        frameArea(boxSize * 1.2, boxSize, boxCenter, camera);

        // OrbitControls가 perspectiveCamera를 dolly out(카메라를 움직여서 멀어지게 하는 거. zoom out이랑 비슷한 효과)를 얼마까지 멀리 할 수 있게 하는지 결정하는거임
        // boxSize의 10배 길이까지 dolly out 할 수 있도록 지정해 줌.
        controls.maxDistance = boxSize * 10;
        controls.target.copy(boxCenter); // 마찬가지로 OrbitControls가 카메라를 돌리거나 움직일 때 카메라의 시선이 항상 bounding box의 가운데점을 향하도록 지정한 것.
        controls.update(); // 값을 바꿔줬으니 업데이트 메서드를 호출한 것.
      });
    })
  }

  // resize renderer
  function resizeRendererToDisplaySize(renderer) {
    const canvas = renderer.domElement;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    const needResize = canvas.width !== width || canvas.height !== height;
    if (needResize) {
      renderer.setSize(width, height, false);
    }
    return needResize;
  }

  // animate
  function animate() {
    // 렌더러가 리사이징 되었다면 카메라의 비율(aspect)도 리사이징된 사이즈에 맞춰서 업데이트 해줘야 함.
    if (resizeRendererToDisplaySize(renderer)) {
      const canvas = renderer.domElement;
      camera.aspect = canvas.clientWidth / canvas.clientHeight;
      camera.updateProjectionMatrix();
    }

    renderer.render(scene, camera);

    requestAnimationFrame(animate); // 내부적으로 반복 호출해주고
  }

  requestAnimationFrame(animate);
}

main();