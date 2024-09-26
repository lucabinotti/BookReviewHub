'use strict';

const path = require('path');
const passport = require('passport');
const {app, port} = require('./init');
const {validationResult} = require('express-validator');
const {fetchBooks, fetchBooksInBackground, searchBook, searchTitles} = require('./books');
const {getUser, getUserId, updateUserIsMod, getBooks, insertBooks, getMostCommentedBooks, insertReview, getReviews, doesReviewExists, deleteReview} = require('./models/dao');


/**
 * Rotta per avviare autenticazione GitHub
 */
app.get('/auth/github', passport.authenticate('github', {scope: ['user:email']}));

/**
 * Rotta di callback dove GitHub ti rimanda dopo il login
 */
app.get('/auth/github/callback',
    passport.authenticate('github', {failureRedirect: '/login'}),
    function(req, res) {
        // Login riuscito, reindirizza l'utente
        res.redirect('/');
    }
);

/**
 * Endpoint per il logout
 */
app.get('/logout-user', (req, res) => {
    req.logout(() => {
        // res.redirect('/');
        res.json({success: true});
    });
});

/**
 * Questo endpoint controlla se l'utente e' autenticato, e restituisce le sue informazioni
 */
app.get('/is-auth', async (req, res) => {
    if(!req.isAuthenticated())
    {
        res.status(200).json({auth: false});
    }
    else
    {
        res.status(200).json(req.user);
    }
});

/**
 * Da usare per impostare l'utente loggato a moderatore, per testare le funzionalita' da moderatore
 */
app.get('/mod', async (req, res) => {
    if(req.isAuthenticated())
    {
        updateUserIsMod(req.user.id, true);
        res.status(200).json({message: 'Sei stato promosso a moderatore.'});
    }
    else res.status(200).json({message: 'Non sei autenticato.'});
});

/**
 * Da usare per impostare l'utente loggato a utente normale, per testare le funzionalita' da moderatore
 */
app.get('/unmod', async (req, res) => {
    if(req.isAuthenticated())
    {
        updateUserIsMod(req.user.id, false);
        res.status(200).json({message: 'Sei stato tolto dai moderatori.'});
    }
    else res.status(200).json({message: 'Non sei autenticato.'});
});

/**
 * Recupera i dettagli di un libro specifico tramite ISBN e le recensioni associate.
 * Se il libro non è presente nel database viene recuperato con API esterne.
 */
app.get('/get-books/:bookId', async (req, res) => {
    let book;
    const queriedBooks = await getBooks([req.params.bookId]);

    // Se è un nuovo libro non ancora presente nel db
    if(Object.keys(queriedBooks).length === 0)
    {
        const books = await fetchBooks([req.params.bookId]);
        if(Object.keys(books).length !== 0) insertBooks(books);
        book = books[req.params.bookId];
    }
    else book = queriedBooks[req.params.bookId];

    if(book !== undefined)
    {
        // const user = {connected: true, profilePicture: '/images/propic.png'};
        const daoReviews = await getReviews(req.params.bookId);
        await getUser(daoReviews.user)
        const reviewsPromises = daoReviews.map(async ({ user: username, date: datetime, text: comment, stars: rate }) => {
            const userObject = await getUser(username);
            return {
                // username: userObject !== undefined ? userObject.username : undefined,
                username: userObject?.username,
                datetime,
                comment,
                rate
            };
        });
        const reviews = await Promise.all(reviewsPromises);
        res.json({book, reviews});
    }
    else res.status(404).json({success: false, message: 'Libro non trovato'});

});

/**
 * Recupera i libri più commentati dal database e restituisce i dettagli.
 */
app.get('/most-commented-books', async (req, res) => {
    const isbns = await getMostCommentedBooks();  // ['8835088585', '1408294222', '8821561577'];
    const books = await getBooks(isbns);
    res.json(books);
});

/**
 * Autocompleta i titoli di libri in base a una query passata come parametro.
 */
app.get('/autocomplete-title', async (req, res) => {
    const errors = validationResult(req);
    if(!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const {title} = req.query;
    try
    {
        const results = await searchTitles(title);

        if(results !== null)
        {
            fetchBooksInBackground(Object.keys(results)).catch(error => console.error(error));
            res.json(Object.values(results).map(value => ({ title: value })));
        }
        else res.json({});
    }
    catch(error)
    {
        console.error('Error executing query', error);
        res.status(500).json({error: 'Internal Server Error'});
    }
});

/**
 * Cerca un libro in base al titolo e reindirizza alla pagina del libro se trovato.
 */
app.get('/search-title', async (req, res) => {
    const errors = validationResult(req);
    if(!errors.isEmpty()) return res.status(400).json({errors: errors.array()});

    const { title } = req.query;
    try
    {
        const book = await searchBook(title);
        if(book !== null)
        {
            // Si vuole eseguire il redirect client-side cosi' da non refreshare la pagina
            // res.redirect(`/books/${book.isbn}`);
            res.status(200).json({redirect: true, url: `/books/${book.isbn}`});
        }
        else res.status(404).send({redirect: false, message: 'Libro non trovato'});
    }
    catch(error)
    {
        console.error('Error executing query', error);
        res.status(500).json({redirect: false, message: 'Internal Server Error'});
    }
});

/**
 * Aggiunge un commento a un libro specifico.
 * Richiede che l'utente sia autenticato.
 */
app.post('/add-comment', async (req, res) => {
    const {isbn, comment, rate} = req.body;

    if(!req.isAuthenticated())
    {
        res.status(401).json(false);
    }
    else
    {
        const user = await getUser(req.user.id);
        if(user !== undefined)
        {
            if(!(await doesReviewExists(isbn, user.id)))
            {
                insertReview(isbn, user.id, Number(rate), comment);
                res.status(201).json({
                    username: user.username,
                    datetime: new Date().toISOString(),
                    comment,
                    rate: Number(rate)
                });
            }
            else
            {
                res.status(409).json({success: false, message: 'Hai già inserito una recensione, non puoi farne un\'altra'});
            }
        }
        else res.status(401).json(false);
    }
});

/**
 * Cancella una recensione di un libro specifico in base all'ISBN e all'username.
 * Solo un moderatore può eseguire questa operazione.
 */
app.delete('/delete-comment/:isbn/:username', async (req, res) => {
    const username = req.params.username;
    const isbn = req.params.isbn;
    if(req.isAuthenticated())
    {
        const user = await getUser(req.user.id);
        if(user !== undefined)
        {
            if(user.is_mod)
            {
                const userId = await getUserId(username);
                if(userId !== undefined)
                {
                    if(await doesReviewExists(isbn, userId.id))
                    {
                        deleteReview(isbn, userId.id);
                        res.status(200).json({success: true, message: 'Recensione cancellata'});
                    }
                    else res.status(404).json({success: false, message: 'La recensione non esiste'});
                }
                else res.status(404).json({success: false, message: 'L\'username non esiste'});
            }
            else res.status(403).json({success: false, message: 'Non sei un moderatore'});
        }
        else res.status(403).json({success: false, message: 'Autenticazione non valida'});
    }
    else res.status(403).json({success: false, message: 'Non sei autenticato'});
});

/**
 * Gestisce tutte le altre richieste e restituisce il file index.html per il routing client-side.
 */
app.get('*', async (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(port, () => console.log(`Running on http://127.0.0.1:${port}`));