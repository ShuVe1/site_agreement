document.addEventListener('DOMContentLoaded', () => {
    initApp();
});

let contracts = JSON.parse(localStorage.getItem('contracts')) || [];

function initApp() {
    setupNavigation();
    setupForm();
    updateContractsList();
    calculateStats();
}

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
    document.getElementById(sectionId).classList.remove('hidden-section');
}

function setupForm() {
    document.getElementById('contractForm').addEventListener('submit', (e) => {
        e.preventDefault();
        addContract({
            number: document.getElementById('contractNumber').value,
            contractor: document.getElementById('contractor').value,
            amount: parseFloat(document.getElementById('amount').value),
            date: document.getElementById('date').value,
            status: document.getElementById('status').value
        });
        e.target.reset();
    });
}

function addContract(contract) {
    contracts.push(contract);
    localStorage.setItem('contracts', JSON.stringify(contracts));
    updateContractsList();
    calculateStats();
}

function updateContractsList() {
    const tbody = document.getElementById('contracts-list');
    tbody.innerHTML = contracts.map((contract, index) => `
        <tr>
            <td>${contract.number}</td>
            <td>${contract.contractor}</td>
            <td>${contract.amount.toFixed(2)} руб.</td>
            <td>${contract.date}</td>
            <td><span class="status">${contract.status}</span></td>
            <td><button onclick="deleteContract(${index})">Удалить</button></td>
        </tr>
    `).join('');
}

function deleteContract(index) {
    contracts.splice(index, 1);
    localStorage.setItem('contracts', JSON.stringify(contracts));
    updateContractsList();
    calculateStats();
}

function calculateStats() {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    
    const monthContracts = contracts.filter(contract => {
        const [year, month] = contract.date.split('-');
        return parseInt(month) === currentMonth + 1 && parseInt(year) === currentYear;
    });
    
    const quarterStart = Math.floor(currentMonth / 3) * 3;
    const quarterContracts = contracts.filter(contract => {
        const [year, month] = contract.date.split('-');
        return parseInt(year) === currentYear && 
               parseInt(month) > quarterStart && 
               parseInt(month) <= quarterStart + 3;
    });
    
    document.getElementById('month-total').textContent = 
        monthContracts.reduce((sum, c) => sum + c.amount, 0).toFixed(2);
        
    document.getElementById('month-count').textContent = monthContracts.length;
    
    document.getElementById('quarter-total').textContent = 
        quarterContracts.reduce((sum, c) => sum + c.amount, 0).toFixed(2);
        
    document.getElementById('quarter-count').textContent = quarterContracts.length;
}

function exportStats() {
    const csvContent = [
        ['Номер договора', 'Контрагент', 'Сумма', 'Дата', 'Статус'],
        ...contracts.map(c => [c.number, c.contractor, c.amount, c.date, c.status])
    ].map(e => e.join(",")).join("\n");

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `contracts_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
}
