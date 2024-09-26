'use strict';

// Ottieni il form dal DOM
const searchForm = document.getElementById('search-form');

// Aggiungi un event listener per l'invio del form
searchForm.addEventListener('submit', async (event) => {
    event.preventDefault();  // Impedisci l'invio del form tradizionale

    // Preleva il valore cercato dall'input field
    const searchField = document.getElementById('search-field');
    const title = searchField.value;

    try
    {
        // Fai una richiesta fetch al server per cercare il libro
        const response = await fetch(`/search-title?title=${encodeURIComponent(title)}`);
        const data = await response.json();

        if(response.ok && data.redirect)
        {
            // Se il server risponde con redirect=true, esegui il redirect client-side con Page.js
            page.redirect(data.url);
        }
        else if(response.status === 404)
        {
            // Nascondi il div con id 'book-menu'
            document.getElementById('book-menu').classList.remove('active');

            // Nascondi il div con id 'main'
            document.getElementById('main').classList.remove('active');

            // Mostra il div con id 'book-not-found'
            document.getElementById('book-not-found').classList.add('active');
        }
        else console.error('Errore imprevisto:', response.status);
    }
    catch(error)
    {
        console.error('Errore durante la ricerca:', error);
    }
});
