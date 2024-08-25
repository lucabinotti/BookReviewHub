/**
 * Si utilizza il bubbling come richiesto dalle specifiche tecniche.
 */

document.getElementById('book-details').addEventListener('submit', function(event) {
    // event.stopPropagation();
    const element = document.getElementById('comments-list-empty');
    if(element)
    {
        element.remove();
    }
});

document.getElementById('add-comment-form').addEventListener('submit', async function(e) {
    e.preventDefault(); // Previeni il submit tradizionale del form

    const isbn = document.getElementById('isbn').value;
    const comment = document.getElementById('comment').value;
    const rate = document.getElementById('rate').value;

    try {
        const response = await fetch('/add-comment', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ isbn, comment, rate })
        });

        if (response.status === 201) {
            const newComment = await response.json();

            // Aggiorna il DOM con il nuovo commento
            const commentsList = document.getElementById('comments-list');

            // Crea il contenitore del nuovo commento
            const newCommentElement = document.createElement('div');
            newCommentElement.className = 'review card mb-4';

            // Crea gli elementi interni
            const cardBody = document.createElement('div');
            cardBody.className = 'card-body';

            const usernameElement = document.createElement('h5');
            usernameElement.className = 'card-title';
            usernameElement.textContent = `${newComment.username} `;

            const datetimeElement = document.createElement('small');
            datetimeElement.className = 'text-muted';
            datetimeElement.textContent = new Date(newComment.datetime).toLocaleString();

            usernameElement.appendChild(datetimeElement);

            const commentElement = document.createElement('p');
            commentElement.className = 'card-text';
            commentElement.textContent = newComment.comment;

            const rateElement = document.createElement('p');
            rateElement.className = 'card-text';
            rateElement.textContent = 'Valutazione: ' + '★'.repeat(newComment.rate) + '☆'.repeat(5 - newComment.rate);

            // Aggiungi gli elementi interni al contenitore del nuovo commento
            cardBody.appendChild(usernameElement);
            cardBody.appendChild(commentElement);
            cardBody.appendChild(rateElement);

            newCommentElement.appendChild(cardBody);

            // Aggiungi il nuovo commento alla lista dei commenti
            commentsList.appendChild(newCommentElement);

            // Reset del form
            document.getElementById('add-comment-form').reset();
        } else {
            console.error('Failed to add comment');
        }
    } catch (error) {
        console.error('Error:', error);
    }
});