const app = {
            currentDay: 0,
            currentPage: 'schedule',
            shiftOpen: false,
            currentOperator: null,
            selectedDate: new Date(),
            selectedService: null,
            selectedStartTime: null,
            editingIndex: null,
            workHours: { start: '10:00', end: '20:00' },
            timeInterval: 30,
            isLoggedIn: false,
            currentUser: null,

            operators: [
                { name: 'Айдана', job: 'Мастер' },
                { name: 'Бекарыс', job: 'Администратор' },
                { name: 'Мадина', job: 'Мастер' },
                { name: 'Томирис', job: 'Косметолог' }
            ],

            standardServices: [
                { name: 'Стрижка', duration: 60 },
                { name: 'Бритье', duration: 30 },
                { name: 'Маникюр', duration: 45 },
                { name: 'Педикюр', duration: 60 },
                { name: 'Массаж', duration: 90 }
            ],

            operatorShifts: {},
            schedule: {
                0: [
                    { service: 'Стрижка', client: 'Айдана', startTime: '10:00', endTime: '11:00', status: 'free' },
                    { service: 'Оформление бороды', client: 'Бекарыс', startTime: '11:30', endTime: '12:30', status: 'booked' }
                ],
                1: [],
                2: [],
                3: [],
                4: [],
                5: [],
                6: []
            },

            loadFromStorage() {
                const savedSchedule = localStorage.getItem('barbershop_schedule');
                if (savedSchedule) {
                    try {
                        this.schedule = JSON.parse(savedSchedule);
                    } catch (e) {
                        console.error('Failed to load schedule:', e);
                    }
                }
                const savedShifts = localStorage.getItem('barbershop_shifts');
                if (savedShifts) {
                    try {
                        this.operatorShifts = JSON.parse(savedShifts);
                    } catch (e) {
                        console.error('Failed to load shifts:', e);
                    }
                }
            },

            saveToStorage() {
                localStorage.setItem('barbershop_schedule', JSON.stringify(this.schedule));
                localStorage.setItem('barbershop_shifts', JSON.stringify(this.operatorShifts));
            },

            init() {
                // Load theme on init
                const savedTheme = localStorage.getItem('theme');
                const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                const isDark = savedTheme === 'dark' || (!savedTheme && prefersDark);
                document.body.classList.toggle('dark', isDark);
                const themeToggle = document.getElementById('theme-toggle');
                if (themeToggle) themeToggle.textContent = isDark ? '☀️' : '🌙';

                this.loadFromStorage();
                this.setToday();
                this.updateDate();
                this.setupEventListeners();
                this.initializeOperatorShifts();
                this.renderServices();
                this.renderStartTimes();
                this.renderSlots();
                this.renderOperatorsList();
                this.saveToStorage();
                setInterval(() => this.updateDate(), 60000);

                // Firebase auth state listener
                if (window.onAuthStateChanged && window.firebaseAuth) {
                    window.onAuthStateChanged(window.firebaseAuth, (user) => {
                        if (user) {
                            this.isLoggedIn = true;
                            this.currentUser = user.email;
                            document.getElementById('account-icon').textContent = '👤 ' + this.currentUser.split('@')[0];
                            this.loadScheduleFromFirebase();
                            this.saveToStorage();
                        } else {
                            this.isLoggedIn = false;
                            this.currentUser = null;
                            document.getElementById('account-icon').textContent = '👤';
                            this.renderSlots();
                            this.saveToStorage();
                        }
                    });
                }
            },

            setToday() {
                this.selectedDate = new Date();
                const today = this.selectedDate.toISOString().split('T')[0];
                document.getElementById('date-input').value = today;
                this.currentDay = this.selectedDate.getDay() === 0 ? 6 : this.selectedDate.getDay() - 1;
                this.updateDayButtons();
            },

            initializeOperatorShifts() {
                this.operators.forEach(op => {
                    this.operatorShifts[op.name] = { open: false, openTime: null };
                });
            },

            updateDate() {
                const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
                const dateStr = this.selectedDate.toLocaleString('ru-RU', options);
                document.getElementById('display-date').textContent = dateStr;
            },

            onDateChange() {
                const dateInput = document.getElementById('date-input').value;
                this.selectedDate = new Date(dateInput + 'T00:00:00');
                this.currentDay = this.selectedDate.getDay() === 0 ? 6 : this.selectedDate.getDay() - 1;
                this.updateDate();
                this.updateDayButtons();
                this.renderSlots();
            },

            updateDayButtons() {
                document.querySelectorAll('.day-btn').forEach((btn, index) => {
                    btn.classList.remove('active-day');
                    if (index === this.currentDay) {
                        btn.classList.add('active-day');
                    }
                });
            },

            setupEventListeners() {
                // Theme toggle
                const themeToggle = document.getElementById('theme-toggle');
                if (themeToggle) {
                    const currentTheme = localStorage.getItem('theme') || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
                    document.body.classList.toggle('dark', currentTheme === 'dark');
                    themeToggle.textContent = currentTheme === 'dark' ? '☀️' : '🌙';

                    themeToggle.addEventListener('click', () => {
                        document.body.classList.toggle('dark');
                        const isDark = document.body.classList.contains('dark');
                        themeToggle.textContent = isDark ? '☀️' : '🌙';
                        localStorage.setItem('theme', isDark ? 'dark' : 'light');
                    });
                }
                document.querySelectorAll('.nav-btn').forEach(btn => {
                    btn.addEventListener('click', (e) => this.switchPage(e.target.dataset.page));
                });

                document.querySelectorAll('.day-btn').forEach(btn => {
                    btn.addEventListener('click', (e) => this.selectDay(parseInt(e.target.dataset.day)));
                });

                document.getElementById('date-input').addEventListener('change', () => this.onDateChange());

                document.getElementById('add-slot-btn').addEventListener('click', () => this.openAddPanel());
                document.getElementById('close-panel-btn').addEventListener('click', () => this.closeAddPanel());
                document.getElementById('cancel-slot-form').addEventListener('click', () => this.closeAddPanel());
                document.getElementById('slot-form').addEventListener('submit', (e) => this.saveSlot(e));

                document.getElementById('cancel-open-shift').addEventListener('click', () => this.closeShiftModal());
                document.getElementById('open-shift-form').addEventListener('submit', (e) => this.confirmOpenShift(e));

                document.getElementById('btn-open-shift').addEventListener('click', () => this.openShiftModal());
                document.getElementById('btn-close-shift').addEventListener('click', () => this.closeShift());

                document.getElementById('account-icon').addEventListener('click', () => this.openLoginModal());
                document.getElementById('cancel-login').addEventListener('click', () => this.closeLoginModal());
                document.getElementById('login-form').addEventListener('submit', (e) => this.handleLogin(e));
                document.getElementById('register-btn').addEventListener('click', (e) => this.handleRegister(e));
            },

            renderServices() {
                const container = document.getElementById('service-buttons');
                container.innerHTML = this.standardServices.map(svc => `
                    <button type="button" class="service-btn" data-service="${svc.name}" data-duration="${svc.duration}">
                        ${svc.name} (${svc.duration} мин)
                    </button>
                `).join('');

                container.querySelectorAll('.service-btn').forEach(btn => btn.classList.remove('selected'));
                container.addEventListener('click', (e) => {
                    if (e.target.matches('.service-btn')) {
                        container.querySelectorAll('.service-btn').forEach(btn => btn.classList.remove('selected'));
                        e.target.classList.add('selected');
                        this.selectedService = {
                            name: e.target.dataset.service,
                            duration: parseInt(e.target.dataset.duration)
                        };
                        document.getElementById('custom-service').value = '';
                        this.updateEndTime();
                    }
                });
            },

            renderStartTimes() {
                const container = document.getElementById('start-time-picker');
                const times = this.getAvailableTimes();
                container.innerHTML = times.map(time => `
                    <button type="button" class="time-btn" data-time="${time}">${time}</button>
                `).join('');

                container.querySelectorAll('.time-btn').forEach(btn => btn.classList.remove('selected'));
                container.addEventListener('click', (e) => {
                    if (e.target.matches('.time-btn')) {
                        container.querySelectorAll('.time-btn').forEach(btn => btn.classList.remove('selected'));
                        e.target.classList.add('selected');
                        this.selectedStartTime = e.target.dataset.time;
                        this.updateEndTime();
                    }
                });
            },

            getAvailableTimes() {
                const times = [];
                const [startHour, startMin] = this.workHours.start.split(':').map(Number);
                const [endHour, endMin] = this.workHours.end.split(':').map(Number);

                let current = new Date();
                current.setHours(startHour, startMin, 0);

                const end = new Date();
                end.setHours(endHour, endMin, 0);

                while (current < end) {
                    const hours = String(current.getHours()).padStart(2, '0');
                    const mins = String(current.getMinutes()).padStart(2, '0');
                    times.push(`${hours}:${mins}`); 
                    current.setMinutes(current.getMinutes() + this.timeInterval);
                }

                return times;
            },

            updateEndTime() {
                if (!this.selectedService || !this.selectedStartTime) {
                    document.getElementById('auto-end-time').textContent = '-';
                    return;
                }

                const [hours, mins] = this.selectedStartTime.split(':').map(Number);
                const end = new Date();
                end.setHours(hours, mins + this.selectedService.duration);

                const endHours = String(end.getHours()).padStart(2, '0');
                const endMins = String(end.getMinutes()).padStart(2, '0');
                const endTime = `${endHours}:${endMins}`;

                document.getElementById('auto-end-time').textContent = endTime;
            },

            switchPage(page) {
                this.currentPage = page;
                document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
                document.getElementById(`${page}-page`).classList.add('active');
                
                document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
                const activeBtn = document.querySelector(`.nav-btn[data-page="${page}"]`);
                if (activeBtn) activeBtn.classList.add('active');

                if (page === 'admin') {
                    this.renderOperatorsList();
                }
            },

            selectDay(day) {
                const dayDifference = day - this.currentDay;
                this.selectedDate.setDate(this.selectedDate.getDate() + dayDifference);
                this.currentDay = day;
                const newDate = this.selectedDate.toISOString().split('T')[0];
                document.getElementById('date-input').value = newDate;
                this.updateDate();
                this.updateDayButtons();
                this.renderSlots();
            },

            openAddPanel() {
                document.getElementById('add-slot-panel').classList.add('active');
                this.resetForm();
            },

            closeAddPanel() {
                document.getElementById('add-slot-panel').classList.remove('active');
                this.resetForm();
            },

            resetForm() {
                document.getElementById('slot-form').reset();
                this.selectedService = null;
                this.selectedStartTime = null;
                document.querySelectorAll('.service-btn').forEach(btn => btn.classList.remove('selected'));
                document.querySelectorAll('.time-btn').forEach(btn => btn.classList.remove('selected'));
                document.getElementById('auto-end-time').textContent = '-';
            },

            saveSlot(e) {
                e.preventDefault();

                const serviceName = this.selectedService ? this.selectedService.name : 
                                    document.getElementById('custom-service').value;
                
                if (!serviceName) {
                    alert('Пожалуйста, выберите услугу');
                    return;
                }

                if (!this.selectedStartTime) {
                    alert('Пожалуйста, выберите время начала');
                    return;
                }

                const clientName = document.getElementById('client-name').value;
                const status = document.getElementById('slot-status').value;

                const [hours, mins] = this.selectedStartTime.split(':').map(Number);
                const endDate = new Date();
                endDate.setHours(hours, mins + (this.selectedService?.duration || 60));

                const endHours = String(endDate.getHours()).padStart(2, '0');
                const endMins = String(endDate.getMinutes()).padStart(2, '0');
                const endTime = `${endHours}:${endMins}`;

                const newSlot = {
                    service: serviceName,
                    client: clientName,
                    startTime: this.selectedStartTime,
                    endTime: endTime,
                    status: status
                };

                this.schedule[this.currentDay].push(newSlot);
                this.schedule[this.currentDay].sort((a, b) => a.startTime.localeCompare(b.startTime));
                this.renderSlots();
                this.closeAddPanel();
                this.saveToStorage();

                // Save to Firebase if logged in
                if (this.isLoggedIn && window.saveSlotToFirebase) {
                    window.saveSlotToFirebase.call(this, this.currentDay, this.schedule[this.currentDay]);
                }
            },

            renderSlots() {
                const slots = this.schedule[this.currentDay];
                const container = document.getElementById('slots-list');

                if (slots.length === 0) {
                    container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📅</div>Нет записей на этот день</div>';
                    return;
                }

                container.innerHTML = slots.map((slot, index) => `
                    <article class="slot-card ${slot.status}-slot">
                        <div class="slot-info">
                            <h2 class="slot-title">${slot.startTime} - ${slot.endTime} - ${slot.service}</h2>
                            <p class="slot-subtitle">${slot.client ? `Клиент: ${slot.client}` : 'Свободный слот'}</p>
                        </div>
                        <div class="slot-action">
                            <span class="status-badge ${slot.status}-badge">
                                ${slot.status === 'free' ? 'Свободно' : slot.status === 'booked' ? 'Занято' : 'Не оплачено'}
                            </span>
                            <div class="btn-group">
                                <button class="delete-btn" onclick="app.deleteSlot(${index})">Удалить</button>
                            </div>
                        </div>
                    </article>
                `).join('');
            },

            deleteSlot(index) {
                if (confirm('Вы уверены, что хотите удалить эту запись?')) {
                    this.schedule[this.currentDay].splice(index, 1);
                    this.renderSlots();
                    this.saveToStorage();
                    // Update Firebase if logged in
                    if (this.isLoggedIn && window.saveSlotToFirebase) {
                        window.saveSlotToFirebase.call(this, this.currentDay, this.schedule[this.currentDay]);
                    }
                }
            },

            renderOperatorsList() {
                const container = document.getElementById('operators-list');
                container.innerHTML = this.operators.map(op => {
                    const isOpen = this.operatorShifts[op.name]?.open || false;
                    const openTime = this.operatorShifts[op.name]?.openTime || null;
                    return `
                        <div class="operator-item ${isOpen ? 'open' : ''}">
                            <div class="operator-status-indicator ${isOpen ? 'open' : 'closed'}"></div>
                            <div class="operator-info">
                                <div class="operator-name">${op.name}</div>
                                <div class="operator-job">${op.job}</div>
                            </div>
                            <div class="operator-time">${isOpen ? `Открыта с ${openTime}` : 'Смена закрыта'}</div>
                        </div>
                    `;
                }).join('');
            },

            openShiftModal() {
                const select = document.getElementById('operator-select');
                select.innerHTML = '<option value="">-- Выберите имя --</option>';
                this.operators.forEach(op => {
                    const option = document.createElement('option');
                    option.value = op.name;
                    option.textContent = `${op.name} (${op.job})`;
                    if (this.operatorShifts[op.name]?.open) {
                        option.disabled = true;
                        option.textContent += ' - открыта';
                    }
                    select.appendChild(option);
                });
                document.getElementById('open-shift-modal').classList.add('active');
            },

            closeShiftModal() {
                document.getElementById('open-shift-modal').classList.remove('active');
            },

            confirmOpenShift(e) {
                e.preventDefault();
                const operatorName = document.getElementById('operator-select').value;
                
                if (operatorName) {
                    const now = new Date();
                    const time = now.getHours().toString().padStart(2, '0') + ':' + 
                                now.getMinutes().toString().padStart(2, '0');
                    
                    this.operatorShifts[operatorName] = { open: true, openTime: time };
                    this.currentOperator = operatorName;
                    this.shiftOpen = true;
                    
                    this.updateShiftStatus();
                    this.renderOperatorsList();
                    this.closeShiftModal();
                    this.saveToStorage();
                }
            },

            closeShift() {
                if (this.currentOperator) {
                    this.operatorShifts[this.currentOperator] = { open: false, openTime: null };
                    this.currentOperator = null;
                    this.shiftOpen = false;
                    
                    this.updateShiftStatus();
                    this.renderOperatorsList();
                    this.saveToStorage();
                }
            },

            updateShiftStatus() {
                const statusText = this.shiftOpen ? `Смена открыта (${this.currentOperator})` : 'Смена закрыта';
                const color = this.shiftOpen ? '#ff69b4' : '#ffb6d9';
                const statusEl = document.getElementById('shift-status-text');
                if (statusEl) {
                    statusEl.textContent = statusText;
                    statusEl.style.color = color;
                }
                const openBtn = document.getElementById('btn-open-shift');
                const closeBtn = document.getElementById('btn-close-shift');
                if (openBtn) openBtn.disabled = this.shiftOpen;
                if (closeBtn) closeBtn.disabled = !this.shiftOpen;
            },

            openLoginModal() {
                if (this.isLoggedIn) {
                    if (confirm('Вы хотите выйти из аккаунта?')) {
                        if (window.signOut && window.firebaseAuth) {
                            window.signOut(window.firebaseAuth).then(() => {
                                alert('Вы вышли из аккаунта.');
                            }).catch((error) => {
                                alert('Ошибка выхода: ' + error.message);
                            });
                        }
                    }
                    return;
                }
                document.getElementById('login-modal').classList.add('active');
            },

            closeLoginModal() {
                document.getElementById('login-modal').classList.remove('active');
            },

            handleLogin(e) {
                e.preventDefault();
                const email = document.getElementById('email').value;
                const password = document.getElementById('password').value;
                
                if (window.signInWithEmailAndPassword && window.firebaseAuth) {
                    window.signInWithEmailAndPassword(window.firebaseAuth, email, password)
                        .then((userCredential) => {
                            this.isLoggedIn = true;
                            this.currentUser = userCredential.user.email;
                            this.closeLoginModal();
                            alert('Добро пожаловать!');
                            document.getElementById('account-icon').textContent = '👤 ' + this.currentUser.split('@')[0];
                        })
                        .catch((error) => {
                            alert('Ошибка входа: ' + error.message);
                        });
                }
            },

            handleRegister(e) {
                e.preventDefault();
                const email = document.getElementById('email').value;
                const password = document.getElementById('password').value;
                
                if (window.createUserWithEmailAndPassword && window.firebaseAuth) {
                    window.createUserWithEmailAndPassword(window.firebaseAuth, email, password)
                        .then((userCredential) => {
                            this.isLoggedIn = true;
                            this.currentUser = userCredential.user.email;
                            this.closeLoginModal();
                            alert('Регистрация успешна!');
                            document.getElementById('account-icon').textContent = '👤 ' + this.currentUser.split('@')[0];
                        })
                        .catch((error) => {
                            alert('Ошибка регистрации: ' + error.message);
                        });
                }
            },

            async loadScheduleFromFirebase() {
                if (!window.getDocs || !window.firebaseDb || !this.currentUser) return;
                try {
                    const q = window.query(window.collection(window.firebaseDb, 'schedules'), window.where('userId', '==', this.currentUser));
                    const querySnapshot = await window.getDocs(q);
                    querySnapshot.forEach((docSnap) => {
                        const data = docSnap.data();
                        if (this.schedule[data.day] !== undefined) {
                            this.schedule[data.day] = data.slots || [];
                        }
                    });
                    this.renderSlots();
                    this.saveToStorage();
                } catch (error) {
                    console.error('Error loading from Firebase:', error);
                }
            }
        };

        app.init();
