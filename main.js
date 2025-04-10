const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

window.addEventListener("resize", () => {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
});

const keys = {
  left: false,
  right: false,
  up: false,
  down: false
};

window.addEventListener("keydown", (e) => {
  const key = e.key.toLowerCase();
  if (key === "a" || key === "ф") keys.left = true;
  if (key === "d" || key === "в") keys.right = true;
  if (key === "w" || key === "ц") keys.up = true;
  if (key === "s" || key === "ы") keys.down = true;

  if (key === "p") {
    activateAutopilot(); // при нажатии "p"
  }
});

window.addEventListener("keyup", (e) => {
  const key = e.key.toLowerCase();
  if (key === "a" || key === "ф") keys.left = false;
  if (key === "d" || key === "в") keys.right = false;
  if (key === "w" || key === "ц") keys.up = false;
  if (key === "s" || key === "ы") keys.down = false;
});





//TODO:   Настроить Автопилот при нажатии на кнопку "P" - действует 10 секунд, к/д 60 сек
//TODO:   В начале игры в левом верхнем углу написать команды для управления, во время игры там будут команды типа Автопилота 
//TODO:   Добавить разных спсобностей типа выброс бомбы вверх(она делает уничтожение по горизонтали) или появляются 2 помошника на некотрое время
//TODO:   Добавить других врагов которые стреляют, препядствия и Босса



const playerImage = new Image();
playerImage.src = "images/SpaceShip_1.png";

const enemyImage = new Image();
enemyImage.src = "images/enemy_1.png";

const backgroundImage = new Image();
backgroundImage.src = "images/fon_2.png";


const bullets = [];
const enemies = [];
const explosions = [];
let coins = 0;
let killedEnemies = 0;
let waveCountdown = null;
let countdownValue = 3;
let showWaveText = false;
let waveStartTime = 0;
let waveStarted = false;

let isShooting = false;
let shootInterval = null;
let fireRate = 200;  // миллисекунды между выстрелами
let extraCannons = false; // флаг, что у нас есть дополнительные пушки
let extraCannons_2 = false;
let extraCannons_3 = false;
let speedLevel = 1; // 1..3
let fireLevel = 1;  // 1..3
// Массивы с ценами: [ уровень1→2, уровень2→3, уровень3→(макс) ]
// Индекс 0 означает апгрейд с 1го уровня на 2й, индекс 1 — с 2го на 3й
const speedCosts = [20, 30];
const fireCosts = [30, 40];
let isAutopilot = false;
let autopilotEndTime = 0; // когда автопилот отключится



coins+=10000



// ================== КЛАСС ИГРОК ===================
class Player {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.width = 90;
    this.height = 90;
    this.speed = 13;
    this.level = 1;
    this.image = new Image();
    this.image.src = "images/SpaceShip_1.png";
  }

  upgrade() {
    if (this.level === 1 && killedEnemies >= 10) {
      this.level = 2;
      this.image.src = "images/SpaceShip_2.png";
      this.width = 200;
      this.height = 100;
    }
    else if(this.level === 2 && killedEnemies >= 40){
      this.level = 3;
      this.image.src = "images/SpaceShip_3.png";
      this.width = 220;
      this.height = 220;
    }
  }

  draw() {
    ctx.drawImage(this.image, this.x, this.y, this.width, this.height);
  }
}

const player = new Player(canvas.width / 2, canvas.height - 100);

// ================== КЛАСС ВРАГ ===================
class Enemy {
  constructor(x, y, hp = 1, reward = 1, speed = 3) {
    this.x = x;
    this.y = y;
    this.width = 75;  // твой увеличенный размер
    this.height = 75;
    this.hp = hp;
    this.maxHp = hp;  // максимальное HP (для полоски)
    this.reward = reward; // награда
    this.speed = speed;
    this.color = "red";
  }
  

  update() {
    this.y += this.speed;
  }

  draw() {
    // Враг — изображение корабля врага
    ctx.drawImage(enemyImage, this.x, this.y, this.width, this.height);
  
    // Полоска HP с отступами
    const barWidth = this.width - 20; // уменьшаем на 20 пикселей (по 10 с каждой стороны)
    const hpWidth = barWidth * (this.hp / this.maxHp); 
  
    ctx.fillStyle = "red";
    ctx.fillRect(this.x + 10, this.y - 6, barWidth, 4); // фон полоски (красный)
  
    ctx.fillStyle = "lime";
    ctx.fillRect(this.x + 10, this.y - 6, hpWidth, 4);  // текущий HP (зеленый)
  }
  
  

  isOffscreen() {
    return this.y > canvas.height;
  }
}

// ================== КЛАСС ВОЛНА ===================
class Wave {
  constructor(enemyCount, spawnInterval, enemiesPerSpawn, enemyConfig, name = "Волна") {
    this.enemyCount = enemyCount;
    this.spawnInterval = spawnInterval;
    this.enemiesPerSpawn = enemiesPerSpawn;
    this.enemyConfig = enemyConfig;
    this.spawned = 0;
    this.timer = 0;
    this.finished = false;
    this.name = name;
  }

  update(deltaTime) {
    if (this.spawned >= this.enemyCount) {
      this.finished = true;
      return;
    }

    this.timer += deltaTime;
    if (this.timer >= this.spawnInterval && this.spawned < this.enemyCount) {
      for (let i = 0; i < this.enemiesPerSpawn && this.spawned < this.enemyCount; i++) {
        const x = Math.random() * (canvas.width - 50);
        enemies.push(new Enemy(x, -50, this.enemyConfig.hp, this.enemyConfig.reward, this.enemyConfig.speed));
        this.spawned++;
      }
      this.timer = 0;
    }
  }
}

// ================== ВОЛНЫ ===================
let waves = [];
let currentWaveIndex = 0;

function setupWaves() {
  waves.push(new Wave(10, 1500, 1, { hp: 1, reward: 1, speed: 3 }, "Начальная волна"));
  waves.push(new Wave(30, 2000, 2, { hp: 2, reward: 2, speed: 4 }, "Волна 2"));
  waves.push(new Wave(70, 1000, 1, { hp: 3, reward: 5, speed: 4 }, "Финальная волна"));
}
setupWaves();



// ================== ПАНЕЛЬ УЛУЧШЕНИЙ ===================


// Переключение вкладок
function switchTab(tabId) {
  const tabs = document.querySelectorAll('.tab');
  tabs.forEach(tab => tab.classList.remove('active'));

  const activeTab = document.getElementById(tabId);
  if (activeTab) activeTab.classList.add('active');
}


// Функция для обновления UI
function updateUpgradeUI() {
  // 1) Скорость
  document.getElementById("speedLevelText").textContent = speedLevel;
  if (speedLevel >= 3) {
    document.getElementById("upgradeSpeedBtn").disabled = true;
    document.getElementById("upgradeSpeedBtn").textContent = "Макс";
  } else {
    // Показываем актуальную стоимость для следующего уровня
    const cost = speedCosts[speedLevel - 1]; // если speedLevel=1, берём cost[0]
    document.getElementById("upgradeSpeedBtn").disabled = false;
    document.getElementById("upgradeSpeedBtn").textContent = `Купить за ${cost} 🪙`;
  }

  // 2) Скорострельность
  document.getElementById("fireLevelText").textContent = fireLevel;
  if (fireLevel >= 3) {
    document.getElementById("upgradeFireBtn").disabled = true;
    document.getElementById("upgradeFireBtn").textContent = "Макс";
  } else {
    const cost = fireCosts[fireLevel - 1];
    document.getElementById("upgradeFireBtn").disabled = false;
    document.getElementById("upgradeFireBtn").textContent = `Купить за ${cost} 🪙`;
  }
}

function upgradeSpeed() {
  if (speedLevel < 3) {
    // Цена для перехода со speedLevel => speedLevel+1
    const cost = speedCosts[speedLevel - 1]; 
    if (coins >= cost) {
      coins -= cost; 
      speedLevel++; // повышаем уровень
      // Увеличиваем скорость игрока на +5 за каждый новый уровень (пример)
      player.speed += 5;
      // Обновим UI
      updateUpgradeUI();
    }
  }
}

function upgradeFire() {
  if (fireLevel < 3) {
    const cost = fireCosts[fireLevel - 1];
    if (coins >= cost) {
      coins -= cost;
      fireLevel++; 
      // Уменьшаем интервал стрельбы на 30 мс каждый уровень (пример)
      fireRate = Math.max(50, fireRate - 30);

      // Если лкм зажата, пересоздадим интервал
      if (isShooting) {
        clearInterval(shootInterval);
        shootInterval = setInterval(shoot, fireRate);
      }
      // Обновим UI
      updateUpgradeUI();
    }
  }
}

function addCannons() {
  // Цена 50 монет
  // Если у нас уже есть каноны, повторно не включаем
  if (coins >= 50 && !extraCannons) {
    coins -= 50;
    extraCannons = true;
    console.log("Добавлены дополнительные пушки!");
  }
  else if(coins >= 50 && !extraCannons_2){
    coins -= 50;
    extraCannons_2 = true;
    console.log("Добавлены боковые пушки!");
  }
  else if(coins >= 50 && !extraCannons_3){
    coins -= 50;
    extraCannons_3 = true;
    console.log("Добавлены ещё боковые пушки!");
  }
}





// ================== СТРЕЛЬБА ===================
canvas.addEventListener("mousedown", (e) => {
  if (e.button === 0) {
    isShooting = true;
    if (!shootInterval) {
      shoot(); // выстрел сразу
      shootInterval = setInterval(shoot, fireRate); // повторяем раз в fireRate мс
    }
  }

  if (e.button === 2) {
    const angles = [-15, -7.5, 0, 7.5, 15];
    angles.forEach(angle => {
      const rad = angle * Math.PI / 180;
      bullets.push({
        x: player.x + player.width / 2 - 2.5,
        y: player.y,
        width: 7,
        height: 14,
        speed: 14,
        dx: Math.sin(rad) * 14,
        dy: -Math.cos(rad) * 14,
        color: "orange"
      });
    });
  }
});

canvas.addEventListener("mouseup", (e) => {
  if (e.button === 0) {
    isShooting = false;
    clearInterval(shootInterval);
    shootInterval = null;
  }
});

canvas.addEventListener("contextmenu", (e) => {
  e.preventDefault();
});

function shoot() {
  // Сохраняем твою логику уровней:
  if (player.level === 1) {
    // 1 ур. — одна пуля
    bullets.push({
      x: player.x + player.width / 2 - 2.5,
      y: player.y,
      width: 5,
      height: 10,
      speed: 7,
      dx: 0,
      dy: -15,
      color: "yellow"
    });
  } 
  else if (player.level === 2) {
    // 2 ур. — двойной выстрел (левая/правая пушка)
    bullets.push(
      {
        x: player.x + player.width/3,
        y: player.y + 30,
        width: 5,
        height: 10,
        speed: 7,
        dx: 0,
        dy: -15,
        color: "yellow"
      },
      {
        x: player.x + player.width/3*2,
        y: player.y + 30,
        width: 5,
        height: 10,
        speed: 7,
        dx: 0,
        dy: -15,
        color: "yellow"
      }
    );
  }
  else if (player.level === 3) {
    // 3 ур. — тройной выстрел
    bullets.push(
      {
        x: player.x + player.width/3,
        y: player.y + 100,
        width: 5,
        height: 10,
        speed: 9,
        dx: 0,
        dy: -15,
        color: "red"
      },
      {
        x: player.x + player.width/3*2,
        y: player.y + 100,
        width: 5,
        height: 10,
        speed: 9,
        dx: 0,
        dy: -15,
        color: "red"
      },
      {
        x: player.x + player.width/2,
        y: player.y + 20,
        width: 7,
        height: 15,
        speed: 8,
        dx: 0,
        dy: -15,
        color: "red"
      }
    );
  }

  // Дополнительно проверяем extraCannons — если игрок купил «Добавить пушки»
  if (extraCannons) {
    // Добавляем еще 2 диагональные пули (или сколько захочешь)
    bullets.push({
      x: player.x + (player.width/2 - 30),
      y: player.y + 150,
      width: 5,
      height: 10,
      speed: 7,
      dx: -4,     // слегка влево
      dy: -14,
      color: "yellow"
    });
    bullets.push({
      x: player.x + (player.width/2 + 30),
      y: player.y + 150,
      width: 5,
      height: 10,
      speed: 7,
      dx: 4,      // слегка вправо
      dy: -14,
      color: "yellow"
    });
  }

  if (extraCannons_2) {
    // Добавляем 2 боковые пушки
    bullets.push({
      x: player.x + player.width/2,
      y: player.y + player.height/3*2,
      width: 10,
      height: 5,
      speed: 2,
      dx: -90,     // угол 90
      dy: 0,
      color: "yellow"
    });
    bullets.push({
      x: player.x + player.width/2,
      y: player.y + player.height/3*2,
      width: 10,
      height: 5,
      speed: 2,
      dx: 90,      // угол 90
      dy: 0,
      color: "yellow"
    });
  }

  if (extraCannons_3) {
    // Добавляем еще 2 боковые пушки
    bullets.push({
      x: player.x + player.width/2,
      y: player.y + player.height/3*2 + 20,
      width: 10,
      height: 5,
      speed: 5,
      dx: -90,     // угол 90
      dy: 0,
      color: "yellow"
    });
    bullets.push({
      x: player.x + player.width/2,
      y: player.y + player.height/3*2 + 20,
      width: 10,
      height: 5,
      speed: 5,
      dx: 90,      // угол 90
      dy: 0,
      color: "yellow"
    });
  }
}


// ================== ОБНОВЛЕНИЕ ===================
function update() {
  player.upgrade();  // Проверка апгрейда при 50 монетах
  
  if (keys.left && player.x > 0) player.x -= player.speed;
  if (keys.right && player.x + player.width < canvas.width) player.x += player.speed;
  if (keys.up && player.y > 0) player.y -= player.speed;
  if (keys.down && player.y + player.height < canvas.height) player.y += player.speed;

  bullets.forEach((bullet, bIndex) => {
    bullet.x += bullet.dx || 0;
    bullet.y += bullet.dy || -bullet.speed;

    if (
      bullet.y + bullet.height < 0 ||
      bullet.x + bullet.width < 0 ||
      bullet.x > canvas.width
    ) {
      bullets.splice(bIndex, 1);
      return;
    }

    enemies.forEach((enemy, eIndex) => {
      const hit =
        bullet.x < enemy.x + enemy.width &&
        bullet.x + bullet.width > enemy.x &&
        bullet.y < enemy.y + enemy.height &&
        bullet.y + bullet.height > enemy.y;

      if (hit) {
        enemy.hp -= 1;
        bullets.splice(bIndex, 1);
        if (enemy.hp <= 0) {
          explosions.push({
            x: enemy.x + enemy.width / 2,
            y: enemy.y + enemy.height / 2,
            radius: 0,
            maxRadius: 20,
            alpha: 1
          });

          coins += enemy.reward;
          killedEnemies++;
          enemies.splice(eIndex, 1);
        }
      }
    });
  });

  enemies.forEach((enemy, index) => {
    enemy.update();
    if (enemy.isOffscreen()) {
      enemies.splice(index, 1);
    }
  });

  explosions.forEach((exp, index) => {
    exp.radius += 2;
    exp.alpha -= 0.05;
    if (exp.alpha <= 0) {
      explosions.splice(index, 1);
    }
  });

  // Запускаем обратный отсчёт перед волной
  if (
    currentWaveIndex > 0 &&
    !waveCountdown &&
    !waveStarted &&
    enemies.length === 0 &&
    !showWaveText &&
    waves[currentWaveIndex]
  ) {    waveCountdown = setInterval(() => {
      countdownValue--;
      if (countdownValue <= 0) {
        clearInterval(waveCountdown);
        waveCountdown = null;
        countdownValue = 3;
        showWaveText = true;
        waveStarted = true;
        waveStartTime = Date.now();
      }
    }, 1000);
  }

  // Показываем волну 1 секунду, затем убираем
  if (showWaveText && Date.now() - waveStartTime > 1000) {
    showWaveText = false;
  }


  // Обновление текущей волны
  if (waves[currentWaveIndex]) {
    if (!waveCountdown && !showWaveText) {
      waves[currentWaveIndex].update(16);
    }
  }

  // Переход к следующей волне
  if (waves[currentWaveIndex]?.finished && enemies.length === 0) {
    currentWaveIndex++;
    waveStarted = false;
  
    // Сброс показа предыдущей волны
    showWaveText = false;
    waveCountdown = null;
    countdownValue = 3;
  
    // Сброс статуса волны на "не началась"
    if (waves[currentWaveIndex]) {
      waves[currentWaveIndex].finished = false;
      waves[currentWaveIndex].spawned = 0;
      waves[currentWaveIndex].timer = 0;
    }
  }

  // Проверяем, нужно ли отключить автопилот
  if (isAutopilot && performance.now() >= autopilotEndTime) {
    isAutopilot = false;
    isShooting = false; // останавливаем стрельбу
    console.log("Автопилот выключен!");
  }

  // Если автопилот включён — выполняем handleAutopilot()
  if (isAutopilot) {
    handleAutopilot();
  }

}

// ================== ОТРИСОВКА ===================
function draw() {
  ctx.drawImage(backgroundImage, 0, 0, canvas.width, canvas.height);

  // Рисуем игрока через класс
  player.draw();

  // Пули
  bullets.forEach(bullet => {
    ctx.fillStyle = bullet.color;
    ctx.fillRect(bullet.x, bullet.y, bullet.width, bullet.height);
  });

  // Враги
  enemies.forEach(enemy => enemy.draw());

  // Взрывы
  explosions.forEach(exp => {
    ctx.beginPath();
    ctx.arc(exp.x, exp.y, exp.radius, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255, 255, 0, ${exp.alpha})`;
    ctx.fill();
  });

  // Счёт монет
  ctx.fillStyle = "gold";
  ctx.font = "20px Arial";
  ctx.textAlign = "right";
  ctx.fillText(`Монеты: ${coins}`, canvas.width - 20, 30);

  // Кол-во убитых врагов — в левом верхнем углу
  ctx.fillStyle = "white";
  ctx.font = "20px Arial";
  ctx.textAlign = "left";
  ctx.fillText(`Убито: ${killedEnemies}`, 20, 30);

  // Оставшиеся враги — в правом нижнем углу (только для волн 2 и 3)
  if (currentWaveIndex === 1 || currentWaveIndex === 2) {
    const wave = waves[currentWaveIndex];
    const remaining = wave ? (wave.enemyCount - wave.spawned + enemies.length) : 0;

    ctx.fillStyle = "white";
    ctx.font = "18px Arial";
    ctx.textAlign = "right";
    ctx.fillText(`Осталось врагов: ${remaining}`, canvas.width - 20, canvas.height - 20);
  }

  // Имя волны + оставшиеся враги
  if (waves[currentWaveIndex]) {
    const wave = waves[currentWaveIndex];
    const remaining = wave.enemyCount - wave.spawned + enemies.length;

    ctx.fillStyle = "white";
    ctx.font = "20px Arial";
    ctx.textAlign = "center";
    ctx.fillText(`${wave.name} — Осталось: ${remaining}`, canvas.width / 2, 30);
  }

  // Центр экрана — обратный отсчёт или название волны
  if (waveCountdown || showWaveText) {
    ctx.fillStyle = "white";
    ctx.font = "60px Arial";
    ctx.textAlign = "center";

    if (waveCountdown) {
      ctx.fillText(`${countdownValue}`, canvas.width / 2, canvas.height / 2);
    } else if (showWaveText && waves[currentWaveIndex]) {
      ctx.fillText(`ВОЛНА ${currentWaveIndex + 1}`, canvas.width / 2, canvas.height / 2);
    }
  }
}

function activateAutopilot() {
  // Включаем автопилот на 10 секунд
  isAutopilot = true;
  autopilotEndTime = performance.now() + 10000;
  console.log("Автопилот включён на 10 сек!");
}

function handleAutopilot() {
  // Ищем врага с максимальным y (самого низкого на экране)
  if (enemies.length === 0) {
    // Нет врагов — ничего не делаем (или можно искать других целей)
    return;
  }

  let lowestEnemy = enemies[0];
  for (let i = 1; i < enemies.length; i++) {
    if (enemies[i].y > lowestEnemy.y) {
      lowestEnemy = enemies[i];
    }
  }

  // Координата X, куда целимся — центр врага
  const targetX = lowestEnemy.x + lowestEnemy.width / 2;
  // Координата центра игрока
  const playerCenterX = player.x + player.width / 2;
  
  // Если игрок левее цели, двигаем вправо
  if (playerCenterX < targetX - (player.speed/2 - 1)) {
    player.x += player.speed; 
  } 
  // Если игрок правее, двигаем влево
  else if (playerCenterX > targetX + (player.speed/2 + 1)) {
    player.x -= player.speed;
  }

  // Включаем стрельбу, чтобы игрок постоянно стрелял
  if (!isShooting) {
    isShooting = true;
    if (!shootInterval) {
      shoot(); // сразу выстрел
      shootInterval = setInterval(shoot, fireRate);
    }
  }
}



// ================== ИГРОВОЙ ЦИКЛ ===================
function gameLoop() {
  update();
  draw();
  requestAnimationFrame(gameLoop);
}

updateUpgradeUI();
window.focus();
gameLoop();
