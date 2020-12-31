import {
    GLTFLoader
} from './GLTFLoader.js';
// --------------------------------------
// UI相关代码
// ---
// -------------------------------------
function DisBtn(n, str, colorStr) {
    let btn = document.getElementById('connect');
    btn.disabled = n;
    btn.innerHTML = str;
    btn.style.backgroundColor = colorStr;
}

DisBtn(true, '不可用', '#9c9c9c');
// --------------------------------------
// Three.js相关代码，实现Web3D
// ---
// -------------------------------------
// 创建场景
var scene = new THREE.Scene();
// 创建相机
var camera = new THREE.PerspectiveCamera(45, 4/3, 0.1, 1000);
// 创建渲染器
var renderer = new THREE.WebGLRenderer({
    antialias: true
});
// 3D模型对象
var obj;

// 添加光源
var light = new THREE.AmbientLight(0xFFFFFF);
scene.add(light);

// 设置相机位置
camera.position.set(0, 0, 1.4);
// 设置渲染器背景颜色
renderer.setClearColor(new THREE.Color(0x1e1e2b));
// 设置渲染器大小
renderer.setSize(400, 300);

// 渲染
function animate() {
    requestAnimationFrame(animate);
    //obj.rotateY(0.001);
    renderer.render(scene, camera);
}

// 创建加载器
var loader = new GLTFLoader();
// 加载3D对象
loader.load('./microbit.glb', function (gltf) {
    // 模型加载完成
    obj = gltf.scene;
    scene.add(obj);
    // 添加DOM节点
    document.getElementById("model").appendChild(renderer.domElement);
    // 渲染3D模型
    animate();

    DisBtn(false, '连接', '#58bd86');

}, function (xhr) {
    // 模型加载中
    let process = document.getElementById('process');
    process.firstElementChild.style.width = ((xhr.loaded / xhr.total) * 300)+"px";
    console.log("width = "+(xhr.loaded / xhr.total) * 300);

    if (xhr.loaded >= xhr.total) {
        process.style.display = 'none';
    }
}, function (error) {
    // 出现错误
    window.alert('3D模型加载失败: ' + error);
    console.error(error);
});


function ReSetModel() {
    obj.rotation.y = 0;
    obj.rotation.x = 0;
}

function ChangeModel(x, y, z) {
    obj.rotation.y = (x / 1000) * (Math.PI/2);
    obj.rotation.x = (y / 1000) * (Math.PI/2);
}

// --------------------------------------
// 网页蓝牙相关代码，实现Web Bluetooth
// ---
// -------------------------------------
class BlueToothService {
    constructor(ServiceUUID, CharacteristicUUIDs) {
        this.ServiceUUID = ServiceUUID;
        this.ServiceStatus = false;
        this.Service;

        this.CharacteristicUUIDs = CharacteristicUUIDs;
        this.CharacteristicStatus = Array(CharacteristicUUIDs.length);
        this.CharacteristicStatus.forEach(e => {
            e = false;
        });
        this.Characteristic = Array(CharacteristicUUIDs.length);

    }
}

// 加速度传感器服务
var ACCELEROMETER_SERVICE = new BlueToothService(
    // 服务的UUID
    'e95d0753-251d-470a-a062-fa1922dfa9a8',
    // 读值特性UUID
    ['e95dca4b-251d-470a-a062-fa1922dfa9a8']
);

// 设备信息服务
var DEVICE_INFORMATION_SERVICE = new BlueToothService(
    // 服务的UUID
    '0000180a-0000-1000-8000-00805f9b34fb',
    // 读值特性UUID
    ['00002a24-0000-1000-8000-00805f9b34fb']
);

var Connected = false;
var Connected_Device;
var Connected_Server;

var old_X = 0;
var old_Y = 0;
//绑定事件
document.getElementById('connect').onclick = function () {
    if (Connected) {
        //断开连接
        Connected_Device.gatt.disconnect();
        Connected = false;
        UpdateUI();
    } else {
        //建立连接
        DiscoverDevice();
        //连接中，禁用按钮
        DisBtn(true, '连接中', '#9c9c9c');
    }
}

//更新UI
function UpdateUI() {
    if (Connected) {
        DisBtn(false, '断开', '#fa5a5a');
    } else {
        DisBtn(false, '连接', '#58bd86');
        let info = document.getElementById('info');
        info.children[0].innerHTML = "设备：未连接";
        info.children[1].innerHTML = "X = 0";
        info.children[2].innerHTML = "Y = 0";
        info.children[3].innerHTML = "Z = 0";
        ReSetModel();
    }
}

//发现蓝牙设备
function DiscoverDevice() {
    //过滤出我们需要的蓝牙设备
    //过滤器
    var options = {
        filters: [{
            namePrefix: 'BBC'
        }],
        optionalServices: [DEVICE_INFORMATION_SERVICE.ServiceUUID, ACCELEROMETER_SERVICE.ServiceUUID]
    };

    navigator.bluetooth.requestDevice(options)
        .then(device => {
            console.log('> 设备名称: ' + device.name);
            console.log('> 设备Id: ' + device.id);
            console.log('> 是否已连接到其它设备: ' + device.gatt.connected);
            //连接到该设备
            Connected_Device = device;
            ConnectDevice();
        })
        .catch(error => {
            console.log("=> Exception: " + error);
            UpdateUI();
        });
}

//连接到蓝牙设备
function ConnectDevice() {
    Connected_Device.gatt.connect().then(
        function (server) {
            console.log("> 连接到GATT服务器：" + server.device.id);
            console.log("> 连接成功=" + server.connected);
            //将Server赋给全局变量（已连接的GATT服务器
            Connected_Server = server;

            //监听连接断开事件
            Connected_Device.addEventListener('gattserverdisconnected', function () {
                Connected = false;
                UpdateUI();
            });
            //发现GATT服务器的服务
            DiscoverService();
        },
        function (error) {
            console.log("=> Exception:无法连接 - " + error);
            Connected = false;
            UpdateUI();
        });
}

//发现蓝牙设备的服务和特性
function DiscoverService() {
    console.log("> 正在搜索可用的服务......\n> 服务器：" + Connected_Server);

    //已发现的服务
    let ServicesDiscovered = 0;
    Connected_Server.getPrimaryServices()
        .then(Services => {
            //服务总数
            let ServiceSum = Services.length;
            console.log("> 发现服务数量：" + ServiceSum);
            Services.forEach(service => {
                //是否存在加速度计服务
                if (service.uuid == ACCELEROMETER_SERVICE.ServiceUUID) {
                    ACCELEROMETER_SERVICE.ServiceStatus = true;
                }
                //是否存在设备信息服务
                if (service.uuid == DEVICE_INFORMATION_SERVICE.ServiceUUID) {
                    DEVICE_INFORMATION_SERVICE.ServiceStatus = true;
                }
                console.log("> 获取到服务的UUID：" + service.uuid);

                service.getCharacteristics().then(Characteristics => {
                    console.log("> 服务: " + service.uuid);
                    ServicesDiscovered++;
                    //已发现的特性
                    let CharacteristicsDiscovered = 0;
                    //所有的特性
                    let CharacteristicsSum = Characteristics.length;

                    Characteristics.forEach(Characteristic => {

                        CharacteristicsDiscovered++;
                        console.log('>> 特征值(UUID): ' + Characteristic.uuid);
                        if (Characteristic.uuid == ACCELEROMETER_SERVICE.CharacteristicUUIDs[0]) {
                            //获取到加速度计特征值
                            ACCELEROMETER_SERVICE.Characteristic[0] = Characteristic;
                            ACCELEROMETER_SERVICE.CharacteristicStatus[0] = true;
                        }
                        if (Characteristic.uuid == DEVICE_INFORMATION_SERVICE.CharacteristicUUIDs[0]) {
                            //设备型号字符串特性存在
                            DEVICE_INFORMATION_SERVICE.Characteristic[0] = Characteristic;
                            DEVICE_INFORMATION_SERVICE.CharacteristicStatus[0] = true;
                        }
                        if (ServicesDiscovered == ServiceSum && CharacteristicsDiscovered == CharacteristicsSum) {
                            console.log("===>服务搜索完成<===");
                            Connected = true;
                            //更新UI的信息
                            UpdateUI();
                            //读取设备型号
                            ReadModelStr();
                            //实时更新加速度计的数据
                            setTimeout(ShwoAcceleration, 300);

                        }
                    });

                });
            });
        });
}

//读取设备型号字符串
function ReadModelStr() {
    if (!DEVICE_INFORMATION_SERVICE.CharacteristicStatus[0]) {
        console.warn('读取设备型号特性不可用！');
        return;
    }
    DEVICE_INFORMATION_SERVICE.Characteristic[0].readValue()
        .then(value => {
            let data = new Uint8Array(value.buffer);
            let Str = new TextDecoder("utf-8").decode(data);
            let e = document.getElementById("info");
            e.children[0].innerHTML = "设备：" + Str;
        })
        .catch(error => {
            console.warn("=> Exception: " + error);
            DEVICE_INFORMATION_SERVICE.CharacteristicStatus[0] = false;
            return;
        });
}

//实时显示加速度计的数据
function ShwoAcceleration() {
    //通过添加监听加速度计的值改变事件来实现
    if (!ACCELEROMETER_SERVICE.CharacteristicStatus[0]) {
        console.warn('读取加速度计值的特性不可用！');
        return;
    }
    console.log("> 添加监听加速度计通知事件");
    ACCELEROMETER_SERVICE.Characteristic[0].startNotifications()
        .then(_ => {
            console.log("> 加速度计值显示已启用");
            ACCELEROMETER_SERVICE.Characteristic[0].addEventListener('characteristicvaluechanged', _ => {
                let buffer = event.target.value.buffer;
                let dataview = new DataView(buffer);
                let X = dataview.getInt16(0, true);
                let Y = dataview.getInt16(2, true);
                let Z = dataview.getInt16(4, true);

                let e = document.getElementById('info');
                e.children[1].innerHTML = "X = " + X;
                e.children[2].innerHTML = "Y = " + Y;
                e.children[3].innerHTML = "Z = " + Z;

                AFilter_Output(X, Y, 55);
            });
        })
        .catch(error => {
            console.warn("=> Exception: " + error);
            ACCELEROMETER_SERVICE.CharacteristicStatus[0] = false;
            return;
        });

}

//滤除抖动
function AFilter_Output(x, y, exp) {
    x = (Math.abs(Math.abs(old_X) - Math.abs(x)) < exp) ? old_X : x;
    y = (Math.abs(Math.abs(old_Y) - Math.abs(y)) < exp) ? old_Y : y;

    ChangeModel(x, y);
    old_X = x;
    old_Y = y;
}