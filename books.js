'use strict';

const fs = require('fs');
const url = require('url');
const https = require('https');
const {insertBooks, filterNewBooks} = require('./models/dao');

/**
 * Dato un URL di una copertina di un libro, scarica l'immagine nel path specificato
 */
function downloadImage(imageUrl, path) {
    return new Promise((resolve, reject) => {
        const options = {
            headers: {
                'User-Agent': 'BookReviewHub/1.0'
            }
        };
        https.get(imageUrl, options, (res) => {
            if(res.statusCode === 302)
            {
                // Segui il reindirizzamento
                const redirectUrl = url.resolve(imageUrl, res.headers.location);
                downloadImage(redirectUrl, path).then(resolve).catch(reject);
            }
            else if(res.statusCode !== 200)
            {
                reject(new Error(`Failed to get '${imageUrl}' (${res.statusCode})`));
            }
            else
            {
                const file = fs.createWriteStream(path);
                res.pipe(file);
                file.on('finish', () => {
                    file.close(resolve);
                });
            }
        }).on('error', (err) => {
            fs.unlink(path, () => reject(err)); // Elimina il file se c'è un errore
        });
    });
}


/**
 * Scarica i dati da open library di tutti gli isbn, {isbn: {isbn, title, authors, publish_date, publishers, cover_path}, ...}
 */
async function fetchBooks(isbns)
{
    // isbns.forEach(isbn => (isBookNew(isbn) ? newBooks : books).push(isbn));
    const response = await fetch(`https://openlibrary.org/api/books?bibkeys=${isbns.map(isbn => `ISBN:${isbn}`).join(',')}&jscmd=data&format=json`, {
        method: 'GET',
        headers: {'User-Agent': 'BookReviewHub/1.0'}
    });
    if (!response.ok)
    {
        throw new Error('Network response was not ok');
    }
    const data = await response.json();

    const books = {};
    for(const [isbn, book] of Object.entries(data))
    {
        let cover_path;
        if(book.cover !== undefined)
        {
            cover_path = `/images/covers/isbn${isbn.slice(5)}.jpg`;
            await downloadImage(book.cover.large, 'public' + cover_path);
        }
        else
        {
            cover_path = '/images/covers/default.jpg';
        }

        books[isbn.slice(5)] = {
            isbn: isbn.slice(5),
            title: book.title,
            authors: book.authors === undefined ? '-' : book.authors.map(author => author.name).join(', '),
            publish_date: book.publish_date,
            publishers: book.publishers === undefined ? '-' : book.publishers.map(publisher => publisher.name).join(', '),
            cover_path: cover_path
        };
    }

    return books;
}

/**
 * Per fetchare i libri nel mentre che i titoli vengono consigliati mentre si scrive il titolo
 */
async function fetchBooksInBackground(isbns)
{
    const newIsbns = await filterNewBooks(isbns);
    const books = await fetchBooks(newIsbns);
    if(Object.keys(books).length !== 0)
    {
        insertBooks(books);
    }
}

/**
 * Cerca un libro tramite il proprio titolo, trova isbn e poi usa fetchBooks per i dati del libro
 */
async function searchBook(title)
{
    const response = await fetch(`https://openlibrary.org/search.json?title=${encodeURIComponent(title)}&limit=3`, {
        method: 'GET',
        headers: {'User-Agent': 'BookReviewHub/1.0'}
    });
    if(!response.ok)
    {
        throw new Error('Network response was not ok');
    }
    const data = await response.json();
    if(data.numFound > 0)
    {
        // Il primo libro in ordine che ha un isbn valido, operatore ?. per non dare errore se son tutti undefined
        const isbns = data.docs.find(doc => doc.isbn !== undefined)?.isbn;
        if(isbns !== undefined)
        {
            const books = await fetchBooks([isbns[0]]);
            return books[Object.keys(books)[0]];
        }
    }
    return null;
}

/**
 * Restituisce 3 titoli simili a title, {isbn: title, ...}
 */
async function searchTitles(title)
{
    const response = await fetch(`https://openlibrary.org/search.json?title=${encodeURIComponent(title)}&limit=3`, {
        method: 'GET',
        headers: {'User-Agent': 'BookReviewHub/1.0'}
    });
    if(!response.ok)
    {
        throw new Error('Network response was not ok');
    }
    const data = await response.json();
    if(data.numFound > 0)
    {
        const titles = {};
        data.docs.forEach(doc => {
            if(doc.isbn !== undefined)
            {
                titles[doc.isbn[0]] = doc.title;
            }
        });
        return titles;
    }
    return null;
}

module.exports = {fetchBooks, fetchBooksInBackground, searchBook, searchTitles};