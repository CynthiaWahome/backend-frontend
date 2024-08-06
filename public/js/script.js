document.addEventListener('DOMContentLoaded', () => {
    const expenseForm = document.getElementById('expenseForm');
    const expenseList = document.getElementById('expenseList');

    // Function to fetch and display expenses
    async function fetchExpenses() {
        try {
            const response = await fetch('/expenses');
            const expenses = await response.json();
            expenseList.innerHTML = expenses.map(expense => `
                <li>
                    ${expense.name} - $${expense.amount}
                    <button onclick="deleteExpense(${expense.id})">Delete</button>
                    <button onclick="editExpense(${expense.id}, '${expense.name}', ${expense.amount})">Edit</button>
                </li>
            `).join('');
        } catch (error) {
            console.error('Error fetching expenses:', error);
        }
    }

    // Add new expense
    expenseForm.addEventListener('submit', async (event) => {
        event.preventDefault();

        const formData = new FormData(expenseForm);
        const data = Object.fromEntries(formData.entries());

        try {
            const response = await fetch('/expenses', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(data),
            });

            if (response.ok) {
                expenseForm.reset();
                fetchExpenses(); // Refresh the expense list
            } else {
                const result = await response.json();
                alert(`Failed to add expense: ${result.message}`);
            }
        } catch (error) {
            console.error('Error adding expense:', error);
            alert('An error occurred. Please try again.');
        }
    });

    // Delete expense
    window.deleteExpense = async (id) => {
        try {
            const response = await fetch(`/expenses/${id}`, {
                method: 'DELETE',
            });

            if (response.ok) {
                fetchExpenses(); // Refresh the expense list
            } else {
                const result = await response.json();
                alert(`Failed to delete expense: ${result.message}`);
            }
        } catch (error) {
            console.error('Error deleting expense:', error);
            alert('An error occurred. Please try again.');
        }
    };

    // Edit expense
    window.editExpense = (id, name, amount) => {
        expenseForm.querySelector('input[name="name"]').value = name;
        expenseForm.querySelector('input[name="amount"]').value = amount;
        expenseForm.dataset.editId = id;
    };

    // Initialize expense list
    fetchExpenses();
});
