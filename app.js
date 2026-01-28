// Инициализация приложения
document.addEventListener('DOMContentLoaded', () => {
    initApp();
});

// Глобальные переменные
let db = null;
let currentUser = null;

// Роли и их права доступа
const ROLES = {
    ACCOUNTANT: 'accountant',      // Бухгалтер
    CONTRACT_SPECIALIST: 'contract_specialist',  // Договорной специалист
    MANAGER: 'manager'            // Руководитель
};

const PERMISSIONS = {
    [ROLES.ACCOUNTANT]: {
        viewContracts: true,
        viewPayments: true,
        viewReports: true,
        exportData: true,
        markPaymentPaid: true,
        addContract: false,
        editContract: false,
        deleteContract: false,
        manageUsers: false
    },
    [ROLES.CONTRACT_SPECIALIST]: {
        viewContracts: true,
        viewPayments: true,
        viewReports: true,
        exportData: true,
        markPaymentPaid: false,
        addContract: true,
        editContract: true,
        deleteContract: true,
        manageUsers: false
    },
    [ROLES.MANAGER]: {
        viewContracts: true,
        viewPayments: true,
        viewReports: true,
        exportData: true,
        markPaymentPaid: false,
        addContract: true,
        editContract: true,
        deleteContract: true,
        manageUsers: true
    }
};

// Инициализация IndexedDB
async function initDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('PaymentSystemDB', 1);
        
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
            db = request.result;
            resolve(db);
        };
        
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            
            // Хранилище пользователей
            if (!db.objectStoreNames.contains('users')) {
                const userStore = db.createObjectStore('users', { keyPath: 'id', autoIncrement: true });
                userStore.createIndex('username', 'username', { unique: true });
                userStore.createIndex('role', 'role', { unique: false });
            }
            
            // Хранилище договоров
            if (!db.objectStoreNames.contains('contracts')) {
                const contractStore = db.createObjectStore('contracts', { keyPath: 'id', autoIncrement: true });
                contractStore.createIndex('contractNumber', 'contractNumber', { unique: false });
                contractStore.createIndex('counterparty', 'counterparty', { unique: false });
                contractStore.createIndex('status', 'status', { unique: false });
            }
            
            // Хранилище платежей
            if (!db.objectStoreNames.contains('payments')) {
                const paymentStore = db.createObjectStore('payments', { keyPath: 'id', autoIncrement: true });
                paymentStore.createIndex('contractId', 'contractId', { unique: false });
                paymentStore.createIndex('dueDate', 'dueDate', { unique: false });
                paymentStore.createIndex('status', 'status', { unique: false });
            }
            
            // Хранилище уведомлений
            if (!db.objectStoreNames.contains('notifications')) {
                const notificationStore = db.createObjectStore('notifications', { keyPath: 'id', autoIncrement: true });
                notificationStore.createIndex('userId', 'userId', { unique: false });
                notificationStore.createIndex('read', 'read', { unique: false });
            }
        };
    });
}

// Инициализация приложения
async function initApp() {
    try {
        await initDB();
        await initDefaultUsers();
        checkAuth();
    } catch (error) {
        console.error('Ошибка инициализации:', error);
        alert('Ошибка инициализации базы данных');
    }
}

// Создание пользователей по умолчанию
async function initDefaultUsers() {
    const users = await getAll('users');
    if (users.length === 0) {
        await add('users', {
            username: 'accountant',
            password: 'accountant123',
            role: ROLES.ACCOUNTANT,
            fullName: 'Бухгалтер'
        });
        await add('users', {
            username: 'specialist',
            password: 'specialist123',
            role: ROLES.CONTRACT_SPECIALIST,
            fullName: 'Договорной специалист'
        });
        await add('users', {
            username: 'manager',
            password: 'manager123',
            role: ROLES.MANAGER,
            fullName: 'Руководитель'
        });
    }
}

// Проверка авторизации
function checkAuth() {
    const savedUser = sessionStorage.getItem('currentUser');
    if (savedUser) {
        currentUser = JSON.parse(savedUser);
        showMainApp();
    } else {
        showLoginForm();
    }
}

// Показать форму входа
function showLoginForm() {
    document.body.innerHTML = `
        <div class="container">
            <div class="login-form">
                <h1>Вход в систему</h1>
                <form id="loginForm">
                    <div class="form-group">
                        <label>Логин:</label>
                        <input type="text" id="username" required>
                    </div>
                    <div class="form-group">
                        <label>Пароль:</label>
                        <input type="password" id="password" required>
                    </div>
                    <button type="submit">Войти</button>
                </form>
                <div class="login-hint">
                    <p><strong>Тестовые пользователи:</strong></p>
                    <p>Бухгалтер: accountant / accountant123</p>
                    <p>Специалист: specialist / specialist123</p>
                    <p>Руководитель: manager / manager123</p>
                </div>
            </div>
        </div>
    `;
    
    document.getElementById('loginForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;
        await login(username, password);
    });
}

// Авторизация
async function login(username, password) {
    const users = await getAll('users');
    const user = users.find(u => u.username === username && u.password === password);
    
    if (user) {
        currentUser = user;
        sessionStorage.setItem('currentUser', JSON.stringify(user));
        showMainApp();
    } else {
        alert('Неверный логин или пароль');
    }
}

// Выход
function logout() {
    currentUser = null;
    sessionStorage.removeItem('currentUser');
    showLoginForm();
}

// Показать основное приложение
function showMainApp() {
    const permissions = PERMISSIONS[currentUser.role];
    
    document.body.innerHTML = `
        <div class="container">
            <header class="header">
                <h1>Учет платежей по договорам</h1>
                <div class="user-info">
                    <span>Пользователь: ${currentUser.fullName} (${getRoleName(currentUser.role)})</span>
                    <button onclick="logout()">Выход</button>
                </div>
            </header>
            
            <nav class="nav">
                <button data-section="contracts">Договоры</button>
                ${permissions.addContract ? '<button data-section="add">Добавить договор</button>' : ''}
                <button data-section="payments">Платежи</button>
                <button data-section="reports">Отчеты</button>
                ${permissions.manageUsers ? '<button data-section="users">Пользователи</button>' : ''}
            </nav>

            <!-- Секция с договорами -->
            <section id="contracts" class="active-section">
                <h2>Список договоров</h2>
                <div class="filters">
                    <input type="text" id="searchContract" placeholder="Поиск по номеру или контрагенту">
                    <select id="filterStatus">
                        <option value="">Все статусы</option>
                        <option value="active">Активные</option>
                        <option value="completed">Завершенные</option>
                        <option value="suspended">Приостановленные</option>
                    </select>
                </div>
                <table class="contracts-table">
                    <thead>
                        <tr>
                            <th>№ Договора</th>
                            <th>Контрагент</th>
                            <th>Сумма</th>
                            <th>Дата начала</th>
                            <th>Дата окончания</th>
                            <th>Статус</th>
                            <th>Действия</th>
                        </tr>
                    </thead>
                    <tbody id="contracts-list"></tbody>
                </table>
            </section>

            <!-- Форма добавления договора -->
            ${permissions.addContract ? `
            <section id="add" class="hidden-section">
                <h2>Добавить договор</h2>
                <form class="contract-form" id="contractForm">
                    <div class="form-group">
                        <label>Номер договора:</label>
                        <input type="text" id="contractNumber" required>
                    </div>
                    <div class="form-group">
                        <label>Контрагент:</label>
                        <input type="text" id="counterparty" required>
                    </div>
                    <div class="form-group">
                        <label>Общая сумма:</label>
                        <input type="number" id="totalAmount" step="0.01" required>
                    </div>
                    <div class="form-group">
                        <label>Дата начала:</label>
                        <input type="date" id="startDate" required>
                    </div>
                    <div class="form-group">
                        <label>Дата окончания:</label>
                        <input type="date" id="endDate">
                    </div>
                    <div class="form-group">
                        <label>Статус:</label>
                        <select id="status">
                            <option value="active">Активный</option>
                            <option value="completed">Завершен</option>
                            <option value="suspended">Приостановлен</option>
                        </select>
                    </div>
                    <button type="submit">Добавить</button>
                </form>
            </section>
            ` : ''}

            <!-- Секция платежей -->
            <section id="payments" class="hidden-section">
                <h2>Платежи</h2>
                <div class="filters">
                    <select id="paymentStatus">
                        <option value="">Все статусы</option>
                        <option value="pending">Ожидающие</option>
                        <option value="paid">Оплаченные</option>
                        <option value="overdue">Просроченные</option>
                    </select>
                </div>
                <table class="payments-table">
                    <thead>
                        <tr>
                            <th>Договор</th>
                            <th>Контрагент</th>
                            <th>Сумма</th>
                            <th>Срок оплаты</th>
                            <th>Дата оплаты</th>
                            <th>Статус</th>
                            <th>Действия</th>
                        </tr>
                    </thead>
                    <tbody id="payments-list"></tbody>
                </table>
            </section>

            <!-- Отчеты -->
            <section id="reports" class="hidden-section">
                <h2>Отчеты</h2>
                <div class="stats-section">
                    <div class="stat-card">
                        <h3>Статистика за месяц</h3>
                        <p>Общая сумма: <span id="month-total">0</span> руб.</p>
                        <p>Количество договоров: <span id="month-count">0</span></p>
                    </div>
                    <div class="stat-card">
                        <h3>Квартальная статистика</h3>
                        <p>Общая сумма: <span id="quarter-total">0</span> руб.</p>
                        <p>Количество договоров: <span id="quarter-count">0</span></p>
                    </div>
                    <div class="stat-card">
                        <h3>Просроченные платежи</h3>
                        <p>Количество: <span id="overdue-count">0</span></p>
                        <p>Сумма: <span id="overdue-total">0</span> руб.</p>
                    </div>
                </div>
                ${permissions.exportData ? '<button class="export-btn" onclick="exportStats()">Экспорт в CSV</button>' : ''}
            </section>

            ${permissions.manageUsers ? `
            <!-- Управление пользователями -->
            <section id="users" class="hidden-section">
                <h2>Управление пользователями</h2>
                <table class="users-table">
                    <thead>
                        <tr>
                            <th>Логин</th>
                            <th>ФИО</th>
                            <th>Роль</th>
                            <th>Действия</th>
                        </tr>
                    </thead>
                    <tbody id="users-list"></tbody>
                </table>
            </section>
            ` : ''}
        </div>
    `;
    
    setupNavigation();
    if (permissions.addContract) {
        setupForm();
    }
    updateContractsList();
    updatePaymentsList();
    calculateStats();
    if (permissions.manageUsers) {
        updateUsersList();
    }
}

// Получить название роли
function getRoleName(role) {
    const names = {
        [ROLES.ACCOUNTANT]: 'Бухгалтер',
        [ROLES.CONTRACT_SPECIALIST]: 'Договорной специалист',
        [ROLES.MANAGER]: 'Руководитель'
    };
    return names[role] || role;
}

// Навигация
function setupNavigation() {
    document.querySelectorAll('.nav button').forEach(btn => {
        btn.addEventListener('click', () => {
            const sectionId = btn.dataset.section;
            showSection(sectionId);
        });
    });
}

function showSection(sectionId) {
    document.querySelectorAll('section').forEach(section => {
        section.classList.add('hidden-section');
    });
    const section = document.getElementById(sectionId);
    if (section) {
        section.classList.remove('hidden-section');
    }
    
    if (sectionId === 'payments') {
        updatePaymentsList();
    } else if (sectionId === 'reports') {
        calculateStats();
    } else if (sectionId === 'users') {
        updateUsersList();
    }
}

// Форма добавления договора
function setupForm() {
    const form = document.getElementById('contractForm');
    if (!form) return;
    
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const contract = {
            contractNumber: document.getElementById('contractNumber').value,
            counterparty: document.getElementById('counterparty').value,
            totalAmount: parseFloat(document.getElementById('totalAmount').value),
            startDate: document.getElementById('startDate').value,
            endDate: document.getElementById('endDate').value || null,
            status: document.getElementById('status').value,
            userId: currentUser.id
        };
        
        await addContract(contract);
        form.reset();
        showSection('contracts');
    });
}

// Добавить договор
async function addContract(contract) {
    const contractId = await add('contracts', contract);
    
    // Создать график платежей (например, ежемесячные платежи)
    const startDate = new Date(contract.startDate);
    const endDate = contract.endDate ? new Date(contract.endDate) : new Date(startDate.getFullYear() + 1, startDate.getMonth(), startDate.getDate());
    const monthlyAmount = contract.totalAmount / 12;
    
    for (let d = new Date(startDate); d <= endDate; d.setMonth(d.getMonth() + 1)) {
        await add('payments', {
            contractId: contractId,
            amount: monthlyAmount,
            dueDate: d.toISOString().split('T')[0],
            status: 'pending',
            description: `Платеж за ${d.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' })}`
        });
    }
    
    updateContractsList();
    updatePaymentsList();
    calculateStats();
}

// Обновить список договоров
async function updateContractsList() {
    const contracts = await getAll('contracts');
    const tbody = document.getElementById('contracts-list');
    const permissions = PERMISSIONS[currentUser.role];
    
    const searchText = document.getElementById('searchContract')?.value.toLowerCase() || '';
    const filterStatus = document.getElementById('filterStatus')?.value || '';
    
    let filteredContracts = contracts.filter(contract => {
        const matchesSearch = !searchText || 
            contract.contractNumber.toLowerCase().includes(searchText) ||
            contract.counterparty.toLowerCase().includes(searchText);
        const matchesStatus = !filterStatus || contract.status === filterStatus;
        return matchesSearch && matchesStatus;
    });
    
    tbody.innerHTML = filteredContracts.map((contract) => `
        <tr>
            <td>${contract.contractNumber}</td>
            <td>${contract.counterparty}</td>
            <td>${contract.totalAmount.toFixed(2)} руб.</td>
            <td>${contract.startDate}</td>
            <td>${contract.endDate || '-'}</td>
            <td><span class="status status-${contract.status}">${getStatusName(contract.status)}</span></td>
            <td>
                ${permissions.editContract ? `<button onclick="editContract(${contract.id})">Редактировать</button>` : ''}
                ${permissions.deleteContract ? `<button onclick="deleteContract(${contract.id})">Удалить</button>` : ''}
            </td>
        </tr>
    `).join('');
    
    // Настройка фильтров
    if (document.getElementById('searchContract')) {
        document.getElementById('searchContract').addEventListener('input', updateContractsList);
    }
    if (document.getElementById('filterStatus')) {
        document.getElementById('filterStatus').addEventListener('change', updateContractsList);
    }
}

// Обновить список платежей
async function updatePaymentsList() {
    const payments = await getAll('payments');
    const contracts = await getAll('contracts');
    const tbody = document.getElementById('payments-list');
    const permissions = PERMISSIONS[currentUser.role];
    
    const filterStatus = document.getElementById('paymentStatus')?.value || '';
    
    let filteredPayments = payments.filter(payment => {
        if (filterStatus && payment.status !== filterStatus) return false;
        if (filterStatus === 'overdue' && payment.status !== 'pending') return false;
        if (filterStatus === 'overdue') {
            return new Date(payment.dueDate) < new Date();
        }
        return true;
    });
    
    tbody.innerHTML = filteredPayments.map((payment) => {
        const contract = contracts.find(c => c.id === payment.contractId);
        const isOverdue = payment.status === 'pending' && new Date(payment.dueDate) < new Date();
        const status = isOverdue ? 'overdue' : payment.status;
        
        return `
            <tr class="${isOverdue ? 'overdue' : ''}">
                <td>${contract ? contract.contractNumber : 'N/A'}</td>
                <td>${contract ? contract.counterparty : 'N/A'}</td>
                <td>${payment.amount.toFixed(2)} руб.</td>
                <td>${payment.dueDate}</td>
                <td>${payment.paidDate || '-'}</td>
                <td><span class="status status-${status}">${getPaymentStatusName(status)}</span></td>
                <td>
                    ${permissions.markPaymentPaid && payment.status === 'pending' ? 
                        `<button onclick="markPaymentPaid(${payment.id})">Отметить оплаченным</button>` : ''}
                </td>
            </tr>
        `;
    }).join('');
    
    if (document.getElementById('paymentStatus')) {
        document.getElementById('paymentStatus').addEventListener('change', updatePaymentsList);
    }
}

// Отметить платеж как оплаченный
async function markPaymentPaid(paymentId) {
    const payment = await get('payments', paymentId);
    if (payment) {
        payment.status = 'paid';
        payment.paidDate = new Date().toISOString().split('T')[0];
        await update('payments', payment);
        updatePaymentsList();
        calculateStats();
    }
}

// Редактировать договор
async function editContract(contractId) {
    const contract = await get('contracts', contractId);
    if (!contract) return;
    
    const newNumber = prompt('Номер договора:', contract.contractNumber);
    if (newNumber === null) return;
    
    const newCounterparty = prompt('Контрагент:', contract.counterparty);
    if (newCounterparty === null) return;
    
    const newAmount = prompt('Сумма:', contract.totalAmount);
    if (newAmount === null) return;
    
    contract.contractNumber = newNumber;
    contract.counterparty = newCounterparty;
    contract.totalAmount = parseFloat(newAmount);
    
    await update('contracts', contract);
    updateContractsList();
    calculateStats();
}

// Удалить договор
async function deleteContract(contractId) {
    if (confirm('Вы уверены, что хотите удалить этот договор?')) {
        // Удалить связанные платежи
        const payments = await getAll('payments');
        const contractPayments = payments.filter(p => p.contractId === contractId);
        for (const payment of contractPayments) {
            await deleteItem('payments', payment.id);
        }
        
        await deleteItem('contracts', contractId);
        updateContractsList();
        updatePaymentsList();
        calculateStats();
    }
}

// Редактировать пользователя
async function editUser(userId) {
    const user = await get('users', userId);
    if (!user) return;
    
    const newFullName = prompt('ФИО:', user.fullName);
    if (newFullName === null) return;
    
    const newRole = prompt('Роль (accountant/specialist/manager):', user.role);
    if (newRole === null) return;
    
    if (![ROLES.ACCOUNTANT, ROLES.CONTRACT_SPECIALIST, ROLES.MANAGER].includes(newRole)) {
        alert('Неверная роль');
        return;
    }
    
    user.fullName = newFullName;
    user.role = newRole;
    
    await update('users', user);
    if (user.id === currentUser.id) {
        currentUser = user;
        sessionStorage.setItem('currentUser', JSON.stringify(user));
        showMainApp();
    } else {
        updateUsersList();
    }
}

// Удалить пользователя
async function deleteUser(userId) {
    if (confirm('Вы уверены, что хотите удалить этого пользователя?')) {
        await deleteItem('users', userId);
        updateUsersList();
    }
}

// Обновить список пользователей
async function updateUsersList() {
    const users = await getAll('users');
    const tbody = document.getElementById('users-list');
    
    tbody.innerHTML = users.map((user) => `
        <tr>
            <td>${user.username}</td>
            <td>${user.fullName}</td>
            <td>${getRoleName(user.role)}</td>
            <td>
                <button onclick="editUser(${user.id})">Редактировать</button>
                ${user.id !== currentUser.id ? `<button onclick="deleteUser(${user.id})">Удалить</button>` : ''}
            </td>
        </tr>
    `).join('');
}

// Статистика
async function calculateStats() {
    const contracts = await getAll('contracts');
    const payments = await getAll('payments');
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    
    const monthContracts = contracts.filter(contract => {
        const [year, month] = contract.startDate.split('-');
        return parseInt(month) === currentMonth + 1 && parseInt(year) === currentYear;
    });
    
    const quarterStart = Math.floor(currentMonth / 3) * 3;
    const quarterContracts = contracts.filter(contract => {
        const [year, month] = contract.startDate.split('-');
        return parseInt(year) === currentYear && 
               parseInt(month) > quarterStart && 
               parseInt(month) <= quarterStart + 3;
    });
    
    const overduePayments = payments.filter(p => 
        p.status === 'pending' && new Date(p.dueDate) < now
    );
    
    document.getElementById('month-total').textContent = 
        monthContracts.reduce((sum, c) => sum + c.totalAmount, 0).toFixed(2);
    document.getElementById('month-count').textContent = monthContracts.length;
    
    document.getElementById('quarter-total').textContent = 
        quarterContracts.reduce((sum, c) => sum + c.totalAmount, 0).toFixed(2);
    document.getElementById('quarter-count').textContent = quarterContracts.length;
    
    document.getElementById('overdue-count').textContent = overduePayments.length;
    document.getElementById('overdue-total').textContent = 
        overduePayments.reduce((sum, p) => sum + p.amount, 0).toFixed(2);
}

// Экспорт статистики
async function exportStats() {
    const contracts = await getAll('contracts');
    const payments = await getAll('payments');
    
    const csvContent = [
        ['Номер договора', 'Контрагент', 'Сумма', 'Дата начала', 'Дата окончания', 'Статус'],
        ...contracts.map(c => [c.contractNumber, c.counterparty, c.totalAmount, c.startDate, c.endDate || '', c.status])
    ].map(e => e.join(",")).join("\n");

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `contracts_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
}

// Вспомогательные функции для работы с IndexedDB
function add(storeName, data) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.add(data);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

function getAll(storeName) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([storeName], 'readonly');
        const store = transaction.objectStore(storeName);
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

function get(storeName, id) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([storeName], 'readonly');
        const store = transaction.objectStore(storeName);
        const request = store.get(id);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

function update(storeName, data) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.put(data);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

function deleteItem(storeName, id) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.delete(id);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

// Вспомогательные функции
function getStatusName(status) {
    const names = {
        'active': 'Активный',
        'completed': 'Завершен',
        'suspended': 'Приостановлен'
    };
    return names[status] || status;
}

function getPaymentStatusName(status) {
    const names = {
        'pending': 'Ожидает оплаты',
        'paid': 'Оплачен',
        'overdue': 'Просрочен'
    };
    return names[status] || status;
}
