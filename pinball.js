/**
 * @author: YoleeCcopa
 * @description: Codigo base obtenido de https://codepen.io/lonekorean/pen/KXLrVX (Pinball Physics por Will Boyd)
 **/

(() => {
	// plugins
	Matter.use(MatterAttractors);

	// constants
	const PATHS = {
		DOME: '0 0 0 250 19 250 20 231.9 25.7 196.1 36.9 161.7 53.3 129.5 74.6 100.2 100.2 74.6 129.5 53.3 161.7 36.9 196.1 25.7 231.9 20 268.1 20 303.9 25.7 338.3 36.9 370.5 53.3 399.8 74.6 425.4 100.2 446.7 129.5 463.1 161.7 474.3 196.1 480 231.9 480 250 500 250 500 0 0 0',
		DROP_LEFT: '0 0 20 0 70 100 20 150 0 150 0 0',
		DROP_RIGHT: '50 0 68 0 68 150 50 150 0 100 50 0',
		APRON_LEFT: '0 0 180 120 0 120 0 0',
		APRON_RIGHT: '180 0 180 120 0 120 180 0'
	};
	const COLOR = {
		BACKGROUND: '#212529',
		OUTER: '#495057',
		INNER: '#15aabf',
		BUMPER: '#fab005',
		BUMPER_LIT: '#fff3bf',
		PADDLE: '#e64980',
		PINBALL: '#dee2e6'
	};

	const WIREFRAMES = false;
	let bumperBounce = 1.5;
	let paddlePull = 0.002;
	let maxVelocity = 50;

	// Default values for inputs
	const defaultValue = {
		inputNumVelocity: 26,
		inputNumGravity: 0.98,
		inputNumFriction: 0.01
	};

	// score elements
	let $currentScore = $('.current-score span');
	let $highScore = $('.high-score span');
	let $livesDisplay = $('.lives-playes span');
	let $currentVelocity = $('.ball-velocity span');

	// shared variables
	let currentScore, highScore, currentVelocity, lives;
	let engine, world, render, pinball, stopperGroup;
	let leftPaddle, leftUpStopper, leftDownStopper, isLeftPaddleUp;
	let rightPaddle, rightUpStopper, rightDownStopper, isRightPaddleUp;
	
	function load() {
		init();
		createStaticBodies();
		createPaddles();
		createPinball();
		createEvents();
	}
	
	// Validate inputs
	function validatePhysicsInputs() {
		for (let id in defaultValue) {
			const input = document.getElementById(id);
			const value = parseFloat(input.value);
			if (isNaN(value)) {
				input.value = defaultValue[id];
			};
		};
	}
	
	function getValidatedSettings() {
		validatePhysicsInputs();
		return {
			velocity: parseFloat(document.getElementById('inputNumVelocity').value),
			gravity: parseFloat(document.getElementById('inputNumGravity').value),
			friction: parseFloat(document.getElementById('inputNumFriction').value)
		};
	}

	function init() {
		const settings = getValidatedSettings();

		// engine (shared)
		engine = Matter.Engine.create();

		// world (shared)
		world = engine.world;
		world.bounds = {
			min: { x: 0, y: 0},
			max: { x: 700, y: 800 }
		};
		world.gravity.y = settings.gravity; // simulate rolling on a slanted table

		// render (shared)
		render = Matter.Render.create({
			element: $('.container')[0],
			engine: engine,
			options: {
				width: world.bounds.max.x,
				height: world.bounds.max.y,
				wireframes: WIREFRAMES,
				background: COLOR.BACKGROUND
			}
		});
		Matter.Render.run(render);

		highScore = parseInt(localStorage.getItem('highScore')) || 0;
		$highScore.text(highScore);

		// runner
		let runner = Matter.Runner.create();
		Matter.Runner.run(runner, engine);

		// used for collision filtering on various bodies
		stopperGroup = Matter.Body.nextGroup(true);

		// starting values
		currentScore = 0;
		highScore = 0;
		currentVelocity = 0;
		lives = 3;
		isLeftPaddleUp = false;
		isRightPaddleUp = false;
	}

	function createStaticBodies() {
		Matter.World.add(world, [
			// table boundaries (top, bottom, left, right)
			boundary(250, -30, 500, 100),
			boundary(250, 830, 500, 100),
			boundary(-30, 400, 100, 800),
			boundary(590, 400, 220, 800),

			// dome
			path(239, 86, PATHS.DOME),

			// pegs (left, mid, right)
			wall(140, 140, 20, 40, COLOR.INNER),
			wall(225, 140, 20, 40, COLOR.INNER),
			wall(310, 140, 20, 40, COLOR.INNER),

			// top bumpers (left, mid, right)
			bumper(105, 250),
			bumper(225, 250),
			bumper(345, 250),

			// bottom bumpers (left, right)
			bumper(165, 340),
			bumper(285, 340),

			// shooter lane wall
			wall(440, 520, 20, 560, COLOR.OUTER),

			// drops (left, right)
			path(25, 360, PATHS.DROP_LEFT),
			path(425, 360, PATHS.DROP_RIGHT),

			// slingshots (left, right)
			wall(120, 510, 20, 120, COLOR.INNER),
			wall(330, 510, 20, 120, COLOR.INNER),

			// out lane walls (left, right)
			wall(60, 529, 20, 160, COLOR.INNER),
			wall(390, 529, 20, 160, COLOR.INNER),

			// flipper walls (left, right);
			wall(93, 624, 20, 98, COLOR.INNER, -0.96),
			wall(357, 624, 20, 98, COLOR.INNER, 0.96),

			// aprons (left, right)
			path(79, 740, PATHS.APRON_LEFT),
			path(371, 740, PATHS.APRON_RIGHT),

			// reset zones (center, right)
			reset(225, 50),
			reset(465, 30)
		]);
	}

	function createPaddles() {
		// these bodies keep paddle swings contained, but allow the ball to pass through
		leftUpStopper = stopper(160, 591, 'left', 'up');
		leftDownStopper = stopper(140, 743, 'left', 'down');
		rightUpStopper = stopper(290, 591, 'right', 'up');
		rightDownStopper = stopper(310, 743, 'right', 'down');
		Matter.World.add(world, [leftUpStopper, leftDownStopper, rightUpStopper, rightDownStopper]);

		// this group lets paddle pieces overlap each other
		let paddleGroup = Matter.Body.nextGroup(true);

		// Left paddle mechanism
		let paddleLeft = {};
		paddleLeft.paddle = Matter.Bodies.trapezoid(170, 660, 20, 80, 0.33, {
			label: 'paddleLeft',
			angle: 1.57,
			chamfer: {},
			render: {
				fillStyle: COLOR.PADDLE
			}
		});
		paddleLeft.brick = Matter.Bodies.rectangle(172, 672, 40, 80, {
			angle: 1.62,
			chamfer: {},
			render: {
				visible: false
			}
		});
		paddleLeft.comp = Matter.Body.create({
			label: 'paddleLeftComp',
			parts: [paddleLeft.paddle, paddleLeft.brick]
		});
		paddleLeft.hinge = Matter.Bodies.circle(142, 660, 5, {
			isStatic: true,
			render: {
				visible: false
			}
		});
		Object.values(paddleLeft).forEach((piece) => {
			piece.collisionFilter.group = paddleGroup
		});
		paddleLeft.con = Matter.Constraint.create({
			bodyA: paddleLeft.comp,
			pointA: { x: -29.5, y: -8.5 },
			bodyB: paddleLeft.hinge,
			length: 0,
			stiffness: 0
		});
		Matter.World.add(world, [paddleLeft.comp, paddleLeft.hinge, paddleLeft.con]);
		Matter.Body.rotate(paddleLeft.comp, 0.57, { x: 142, y: 660 });

		// right paddle mechanism
		let paddleRight = {};
		paddleRight.paddle = Matter.Bodies.trapezoid(280, 660, 20, 80, 0.33, {
			label: 'paddleRight',
			angle: -1.57,
			chamfer: {},
			render: {
				fillStyle: COLOR.PADDLE
			}
		});
		paddleRight.brick = Matter.Bodies.rectangle(278, 672, 40, 80, {
			angle: -1.62,
			chamfer: {},
			render: {
				visible: false
			}
		});
		paddleRight.comp = Matter.Body.create({
			label: 'paddleRightComp',
			parts: [paddleRight.paddle, paddleRight.brick]
		});
		paddleRight.hinge = Matter.Bodies.circle(308, 660, 5, {
			isStatic: true,
			render: {
				visible: false
			}
		});
		Object.values(paddleRight).forEach((piece) => {
			piece.collisionFilter.group = paddleGroup
		});
		paddleRight.con = Matter.Constraint.create({
			bodyA: paddleRight.comp,
			pointA: { x: 29.5, y: -8.5 },
			bodyB: paddleRight.hinge,
			length: 0,
			stiffness: 0
		});
		Matter.World.add(world, [paddleRight.comp, paddleRight.hinge, paddleRight.con]);
		Matter.Body.rotate(paddleRight.comp, -0.57, { x: 308, y: 660 });
	}

	function createPinball() {
		const settings = getValidatedSettings();
		// x/y are set to when pinball is launched
		pinball = Matter.Bodies.circle(0, 0, 14, {
			label: 'pinball',
			collisionFilter: {
				group: stopperGroup
			},
			friction: settings.friction,
    		frictionAir: settings.friction,
   			restitution: 0.9,
			render: {
				fillStyle: COLOR.PINBALL
			}
		});
		Matter.World.add(world, pinball);
		launchPinball();
	}

	function createEvents() {
		// events for when the pinball hits stuff
		Matter.Events.on(engine, 'collisionStart', function(event) {
			let pairs = event.pairs;
			pairs.forEach(function(pair) {
				if (pair.bodyB.label === 'pinball') {
					switch (pair.bodyA.label) {
						case 'reset':
							launchPinball();
							break;
						case 'bumper':
							pingBumper(pair.bodyA);
							break;
					}
				}
			});
		});
		// regulate pinball
		Matter.Events.on(engine, 'beforeUpdate', function(event) {
            // calc velocity and solve tiny residual movement of Matter.js
            let vx = pinball.velocity.x;
            let vy = pinball.velocity.y;

            let prevVx = 0;
            let prevVy = 0;
            
            // deltaTime is ~1/60s for 60fps; adjust based on your engine settings
            const dt = 1 / 60;

            const ax = (vx - prevVx) / dt;
            const ay = (vy - prevVy) / dt;
            const aMag = Math.sqrt(ax * ax + ay * ay); // to display aceleration

            prevVx = vx;
            prevVy = vy;
            
			// bumpers can quickly multiply velocity, so keep that in check
			let cappedVx = Math.max(Math.min(vx, maxVelocity), -maxVelocity);
			let cappedVy = Math.max(Math.min(vy, maxVelocity), -maxVelocity);
			Matter.Body.setVelocity(pinball, {
				x: cappedVx,
				y: cappedVy
			});

			// cheap way to keep ball from going back down the shooter lane
			if (pinball.position.x > 450 && pinball.velocity.y > 0) {
				Matter.Body.setVelocity(pinball, { x: 0, y: -10 });
			}

            // Clamp small values to 0
            if (Math.abs(vx) < 0.01) vx = 0;
            if (Math.abs(vy) < 0.01) vy = 0;

            const speed = Math.sqrt(vx * vx + vy * vy);

            const isBallStuck = (vx, vy) => Math.abs(vx) < 0.01 && Math.abs(vy) < 0.01;
            
            if (isBallStuck(vx, vy)) {
                $currentVelocity.text('0.00'); // or 'STUCK'
            } else {
                $currentVelocity.text(speed.toFixed(2));
            }
		});
		

		// mouse drag (god mode for grabbing pinball)
		Matter.World.add(world, Matter.MouseConstraint.create(engine, {
			mouse: Matter.Mouse.create(render.canvas),
			constraint: {
				stiffness: 0.2,
				render: {
					visible: false
				}
			}
		}));

		// keyboard paddle events
		$('body').on('keydown', function(e) {
			if (e.which === 37) { // left arrow key
				isLeftPaddleUp = true;
			} else if (e.which === 39) { // right arrow key
				isRightPaddleUp = true;
            }
		});
		$('body').on('keyup', function(e) {
			if (e.which === 37) { // left arrow key
				isLeftPaddleUp = false;
			} else if (e.which === 39) { // right arrow key
				isRightPaddleUp = false;
            }
		});

		// click/tap paddle events
		$('.left-trigger')
			.on('mousedown touchstart', function(e) {
				isLeftPaddleUp = true;
			})
			.on('mouseup touchend', function(e) {
				isLeftPaddleUp = false;
			});
		$('.right-trigger')
		.on('mousedown touchstart', function(e) {
				isRightPaddleUp = true;
			})
			.on('mouseup touchend', function(e) {
				isRightPaddleUp = false;
			});
	}

	function launchPinball() {
		const settings = getValidatedSettings();

		updateScore(0);
		if (lives > 0) {
			lives--;
			$livesDisplay.text(lives + 1);
		} else {
			alert("¡Juego terminado!");
			lives = 3;
			$livesDisplay.text(lives);
			highScore = 0;
			localStorage.removeItem('highScore');
		}
		Matter.Body.setPosition(pinball, { x: 465, y: 765 });
		Matter.Body.setVelocity(pinball, { x: 0, y: -Math.abs(settings.velocity) });
		Matter.Body.setAngularVelocity(pinball, 0);
	}

	function pingBumper(bumper) {
		updateScore(currentScore + 10);

		// flash color
		bumper.render.fillStyle = COLOR.BUMPER_LIT;
		setTimeout(function() {
			bumper.render.fillStyle = COLOR.BUMPER;
		}, 100);
	}

	function updateScore(newCurrentScore) {
		currentScore = newCurrentScore;
		$currentScore.text(currentScore);

		highScore = Math.max(currentScore, highScore);
		$highScore.text(highScore);
		localStorage.setItem('highScore', highScore);
	}

	// matter.js has a built in random range function, but it is deterministic
	function rand(min, max) {
		return Math.random() * (max - min) + min;
	}

	// outer edges of pinball table
	function boundary(x, y, width, height) {
		return Matter.Bodies.rectangle(x, y, width, height, {
			isStatic: true,
			render: {
				fillStyle: COLOR.OUTER
			}
		});
	}

	// wall segments
	function wall(x, y, width, height, color, angle = 0) {
		return Matter.Bodies.rectangle(x, y, width, height, {
			angle: angle,
			isStatic: true,
			chamfer: { radius: 10 },
			render: {
				fillStyle: color
			}
		});
	}

	// bodies created from SVG paths
	function path(x, y, path) {
		let vertices = Matter.Vertices.fromPath(path);
		return Matter.Bodies.fromVertices(x, y, vertices, {
			isStatic: true,
			render: {
				fillStyle: COLOR.OUTER,

				// add stroke and line width to fill in slight gaps between fragments
				strokeStyle: COLOR.OUTER,
				lineWidth: 1
			}
		});
	}

	// round bodies that repel pinball
	function bumper(x, y) {
		let bumper = Matter.Bodies.circle(x, y, 25, {
			label: 'bumper',
			isStatic: true,
			render: {
				fillStyle: COLOR.BUMPER
			}
		});

		// for some reason, restitution is reset unless it's set after body creation
		bumper.restitution = bumperBounce;

		return bumper;
	}

	// invisible bodies to constrict paddles
	function stopper(x, y, side, position) {
		// determine which paddle composite to interact with
		let attracteeLabel = (side === 'left') ? 'paddleLeftComp' : 'paddleRightComp';

		return Matter.Bodies.circle(x, y, 40, {
			isStatic: true,
			render: {
				visible: false,
			},
			collisionFilter: {
				group: stopperGroup
			},
			plugin: {
				attractors: [
					// stopper is always a, other body is b
					function(a, b) {
						if (b.label === attracteeLabel) {
							let isPaddleUp = (side === 'left') ? isLeftPaddleUp : isRightPaddleUp;
							let isPullingUp = (position === 'up' && isPaddleUp);
							let isPullingDown = (position === 'down' && !isPaddleUp);
							if (isPullingUp || isPullingDown) {
								return {
									x: (a.position.x - b.position.x) * paddlePull,
									y: (a.position.y - b.position.y) * paddlePull,
								};
							}
						}
					}
				]
			}
		});
	}

	// contact with these bodies causes pinball to be relaunched
	function reset(x, width) {
		return Matter.Bodies.rectangle(x, 781, width, 2, {
			label: 'reset',
			isStatic: true,
			render: {
				fillStyle: '#fff'
			}
		});
	}

	window.addEventListener('load', load, false);
})();
