'use strict';

/**
 * Fare la fetch delle informazioni dell'utente
 */
async function getUserAuth()
{
    try
    {
        const response = await fetch('/is-auth');
        if(response.ok)
        {
            return await response.json();
        }
        console.error(`Error: ${response.status}`);
    }
    catch(error)
    {
        console.error('Errore nella fetch:', error);
    }
}

/**
 * Fetch dei 3 libri piu' commentati
 */
async function fetchMostCommentedBooks() {
    try
    {
        // Effettua la richiesta all'endpoint
        const response = await fetch('/most-commented-books');

        // Controlla se la risposta è OK
        if(response.ok)
        {
            // Converte la risposta in JSON
            return await response.json();
        }
        console.error(`Error: ${response.status}`);
    }
    catch(error)
    {
        console.error('Errore nella fetch:', error);
    }
}

/**
 * Fetch delle informazioni di un libro
 */
async function fetchBookInfo(bookId) {
    try
    {
        // Effettua la richiesta all'endpoint
        const response = await fetch(`/get-books/${bookId}`);

        // Controlla se la risposta è OK
        if(response.ok)
        {
            // Converte la risposta in JSON
            return await response.json();
        }
        else if(response.status !== 404)
        {
            console.error(`Error: ${response.status}`);
        }
        return undefined;

    }
    catch(error)
    {
        console.error('Errore nella fetch:', error);
    }
}


/**
 * Imposta la nav bar controllando se l'utente e' loggato o no
 */
async function loadNavBar(user)
{
    if(user.auth)
    {
        // L'utente è loggato, mostriamo gli elementi 'logout-navbar' e 'propic-navbar'
        document.getElementById('logout-navbar').classList.add('active');
        document.getElementById('propic-navbar').classList.add('active');
        const propicImg = document.getElementById('propic-img');
        propicImg.src = user.profile_pic;
        propicImg.alt = `Utente ${user.username}`;

        // Nascondiamo l'elemento 'login-navbar'
        document.getElementById('login-navbar').classList.remove('active');
    }
    else
    {
        // L'utente non è loggato, nascondiamo 'logout-navbar' e 'propic-navbar'
        document.getElementById('logout-navbar').classList.remove('active');
        document.getElementById('propic-navbar').classList.remove('active');

        // Mostriamo l'elemento 'login-navbar'
        document.getElementById('login-navbar').classList.add('active');
    }
}

page('/', async () => {

    const user = await getUserAuth();

    await loadNavBar(user);

    // Mostra il div con id 'main'
    document.getElementById('main').classList.add('active');

    // Nascondi breadcrumbs
    document.getElementById('breadcrumbs').classList.remove('active');

    // Nascondi il div con id 'book-menu'
    document.getElementById('book-menu').classList.remove('active');

    // Nascondi il div con id 'book-not-found'
    document.getElementById('book-not-found').classList.remove('active');

    // {
    //   "isbn": "1408294222",
    //   "title": "1984",
    //   "authors": "Michael Dean, George Orwell",
    //   "publish_date": "2008",
    //   "publishers": "Pearson Education",
    //   "cover_path": "/images/covers/isbn1408294222.jpg"
    // }
    const books = await fetchMostCommentedBooks();

    // Itera sui 3 elementi e modifica il DOM
    let i = 1;
    for(const book of Object.values(books))
    {
        // Modifica l'immagine
        const imgElement = document.getElementById(`most-commented-book#${i}`);
        imgElement.src = book.cover_path;
        imgElement.alt = `Copertina ${book.isbn}`;

        // Modifica il titolo del libro
        const titleElement = document.getElementById(`title-book#${i}`);
        titleElement.textContent = book.title;

        // Modifica l'autore
        const authorElement = document.getElementById(`author-book#${i}`);
        authorElement.textContent = book.authors;

        // Modifica il link alle recensioni
        const linkElement = document.getElementById(`read-reviews-book#${i}`);
        linkElement.href = `/books/${book.isbn}`;
        ++i;
    }
});

page('/books/:bookId', async (ctx) => {

    const user = await getUserAuth();
    await loadNavBar(user);

    const req = await fetchBookInfo(ctx.params.bookId);
    if(req !== undefined)
    {
        const book = req.book;
        const comments = req.reviews;

        // Mostra il div con id 'book-menu'
        document.getElementById('book-menu').classList.add('active');

        // Nascondi il div con id 'main'
        document.getElementById('main').classList.remove('active');

        // Nascondi il div con id 'book-not-found'
        document.getElementById('book-not-found').classList.remove('active');

        // Mostra breadcrumbs
        document.getElementById('breadcrumbs').classList.add('active');
        document.getElementById('book-title-breadcrumb').textContent = book.title;

        // Modifica l'immagine
        const imgElement = document.getElementById('book-cover');
        imgElement.src = book.cover_path;
        imgElement.alt = `Copertina ${book.isbn}`;

        // Modifica il titolo del libro
        const titleElement = document.getElementById(`book-title`);
        titleElement.textContent = book.title;

        // Modifica l'autore
        const authorElement = document.getElementById(`book-author`);
        authorElement.textContent = book.authors;

        // Modifica l'editore
        const publisherElement = document.getElementById(`book-publisher`);
        publisherElement.textContent = book.publishers;

        // Modifica data pubblicazione
        const publishDateElement = document.getElementById(`book-date`);
        publishDateElement.textContent = book.publish_date;

        // Imposta isbn nel form per aggiungere commenti
        const isbnElement = document.getElementById(`isbn`);
        isbnElement.value = book.isbn;

        // Trova l'elemento dove inserire i commenti
        const commentsList = document.getElementById('comments-list');

        // Rimuovi eventuali vecchi commenti generati dinamicamente
        commentsList.querySelectorAll('.review').forEach(review => review.remove());

        // Mostra o meno il form per commentare
        if(user.auth)
        {
            document.getElementById('add-comment-form').classList.add('active');
            document.getElementById('login-for-commenting').classList.remove('active');
        }
        else
        {
            document.getElementById('add-comment-form').classList.remove('active');
            document.getElementById('login-for-commenting').classList.add('active');
        }

        // Nascondi paragrafo che dice che hai gia' commentato questo libro
        document.getElementById('already-commented').classList.remove('active');

        if(comments.length > 0)
        {
            // Se ci sono commenti, nascondi il messaggio "Non ci sono ancora recensioni"
            document.getElementById('comments-list-empty').classList.remove('active');

            // Itera su ogni commento e crea dinamicamente un div per ciascun commento
            comments.forEach(comment => {

                // Se l'utente ha gia' commentato, togli il form per commentare
                if(user.username === comment.username)
                {
                    document.getElementById('add-comment-form').classList.remove('active');
                    document.getElementById('already-commented').classList.add('active');
                }

                // Crea un nuovo div per il commento
                const commentDiv = document.createElement('div');
                commentDiv.classList.add('review', 'card', 'mb-4');

                // Crea il corpo del commento
                const cardBody = document.createElement('div');
                cardBody.classList.add('card-body');

                // Aggiungi il nome utente e data
                const username = document.createElement('h5');
                username.classList.add('card-title');

                // username.innerHTML = `${comment.username} <small class="text-muted">${comment.datetime}</small>`;
                username.textContent = comment.username + ' '; // Inserisci il nome utente

                // Crea l'elemento small per la data
                const datetime = document.createElement('small');
                datetime.classList.add('text-muted');
                datetime.textContent = comment.datetime; // Inserisci la data

                // Aggiungi il piccolo elemento small al nome utente
                username.appendChild(datetime);

                // Aggiungi il titolo del nome utente al corpo della card
                cardBody.appendChild(username);

                // Aggiungi il commento solo se esiste, altrimenti non mostrare nulla
                if(comment.comment)
                {
                    const commentText = document.createElement('p');
                    commentText.classList.add('card-text');
                    commentText.textContent = comment.comment;
                    cardBody.appendChild(commentText);
                }

                // Aggiungi la valutazione
                const ratingText = document.createElement('p');
                ratingText.classList.add('card-text');
                ratingText.textContent = `Valutazione: ${'★'.repeat(comment.rate)}${'☆'.repeat(5 - comment.rate)}`;
                cardBody.appendChild(ratingText);

                // Se l'utente e' moderatore aggiungi il tasto elimina per i commenti
                if(user.is_mod)
                {
                    // Crea il div per "Elimina" e la croce
                    const deleteSection = document.createElement('div');
                    deleteSection.classList.add('delete-section', 'hidden', 'active');  // Usa hidden e active per controllare la visibilità

                    // Crea il testo "Elimina"
                    const deleteText = document.createElement('span');
                    deleteText.classList.add('delete-text');
                    deleteText.textContent = 'Elimina';

                    // Crea la croce "X"
                    const deleteCross = document.createElement('span');
                    deleteCross.classList.add('delete-cross');
                    deleteCross.textContent = '\u2715';  // Simbolo Unicode per "X"

                    // Aggiungi il testo e la croce al contenitore
                    deleteSection.appendChild(deleteText);
                    deleteSection.appendChild(deleteCross);

                    // Aggiungi l'evento di click per eliminare il commento
                    deleteCross.addEventListener('click', async () => {
                        const username = comment.username;
                        const isbn = document.getElementById('isbn').value;
                        await fetch(`/delete-comment/${isbn}/${username}`, {
                            method: 'DELETE',
                        })
                            .then(response => {
                                if (response.ok) {
                                    commentDiv.remove();  // Rimuovi l'elemento dal DOM se la cancellazione ha successo
                                    if(user.username === username)
                                    {
                                        document.getElementById('add-comment-form').classList.add('active');
                                        document.getElementById('already-commented').classList.remove('active');
                                    }
                                    console.log('Recensione cancellata con successo');
                                } else {
                                    console.error('Errore durante la cancellazione della recensione');
                                }
                            })
                            .catch(error => {
                                console.error('Errore di rete:', error);
                            });
                    });

                    // Aggiungi la sezione di eliminazione alla card body
                    cardBody.appendChild(deleteSection);
                }

                // Aggiungi il corpo del commento al div del commento
                commentDiv.appendChild(cardBody);

                // Aggiungi il commento alla lista dei commenti
                commentsList.appendChild(commentDiv);
            });
        }
        else
        {
            document.getElementById('comments-list-empty').classList.add('active');
        }
    }
    else
    {
        // Nascondi il div con id 'book-menu'
        document.getElementById('book-menu').classList.remove('active');

        // Nascondi il div con id 'main'
        document.getElementById('main').classList.remove('active');

        // Mostra il div con id 'book-not-found'
        document.getElementById('book-not-found').classList.add('active');

    }
});

page('/logout', async () => {
    try
    {
        const response = await fetch('/logout-user');
        if(!response.ok)
        {
            console.error(`Error: ${response.status}`);
        }
    }
    catch(error)
    {
        console.error('Errore nella fetch:', error);
    }
    page.redirect('/');
});

// Abilita il client-side routing
page();
