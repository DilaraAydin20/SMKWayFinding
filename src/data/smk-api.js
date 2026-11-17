import noImage from '../images/noimage.png'

const apiUrl = 'https://api.smk.dk/api/v1/art/search/';

export let offset = 0; // Gathering artworks from offset (index)
const rows = 20; // Amount of rows being searched at once

const artworksInfo = {
    title:[],
    author:[],
    year:[],
    webUrl:[],
    onDisplay:[],

    image: {
        orientation:[],
        imageUrl:[]
    },
}



export async function getArtworks(){
    try {
        const response = await fetch(
            `${apiUrl}?keys=*&offset${offset}&rows=${rows}`
        );
        const data = await response.json();

        data.items.forEach(artwork => { 
            // Gather all needed data from API
            const title = artwork.documentation[0]?.title ?? 'Undefined';
            const author = artwork.documentation[0]?.author || artwork?.artist[0] || 'Undefined';
            const year = artwork.documentation[0]?.year_of_publication ?? 'Undefined';
            const webUrl = artwork?.frontend_url ?? 'Undefined';
            const display = artwork?.on_display ?? 'Undefined';
            
            const thumbnail = artwork?.image_thumbnail || noImage;
            const orientation = artwork.image_orientation ?? 'Undefined';

            // Push all data to local object
            artworksInfo.title.push(title);
            artworksInfo.author.push(author);
            artworksInfo.year.push(year);
            artworksInfo.webUrl.push(webUrl);
            artworksInfo.onDisplay.push(display);

            artworksInfo.image.imageUrl.push(thumbnail);
            artworksInfo.image.orientation.push(orientation);
            console.log(data);
        })
        renderArtwork();

    } catch(err){
        console.error('Error while retreiving artworks :', err);
    }
}

getArtworks();


function renderArtwork(){
    // Container for artworks (parent)
    const artworkList = document.getElementById('artwork');
    
    
    for (let i = 0; i < artworksInfo.title.length; i++){
        /* Create necessary elements for all cards */
        const card = document.createElement('div');
        const cardTitle = document.createElement('h3');
        const cardAuthor = document.createElement('p');
        const cardYear = document.createElement('p');
        const cardBtn = document.createElement('a');

        const cardImage = document.createElement('img');

        /* Insert data */
        cardTitle.innerHTML = `${artworksInfo.title[i]}`;
        cardAuthor.innerHTML = `${artworksInfo.author[i]}`;
        cardYear.innerHTML = `${artworksInfo.year[i]}`;

        cardImage.src = artworksInfo.image?.imageUrl[i];
        cardBtn.innerText = 'Se værket på SMK';
        if (artworksInfo.webUrl[i]) {
            cardBtn.href = artworksInfo.webUrl[i];
            cardBtn.target = '_blank';
            cardBtn.rel = 'noopener noreferrer';
        } else {
            cardBtn.setAttribute('aria-disabled', 'true');
        }

        /* Apply styling */
        card.classList.add('card');
        cardTitle.classList.add('cardTitle');
        cardAuthor.classList.add('cardAuthor');
        cardYear.classList.add('cardYear');
        cardBtn.classList.add('cardBtn')
        cardImage.classList.add('cardImage');

        /* Nest child elements to card */
        card.appendChild(cardTitle);
        card.appendChild(cardAuthor);
        card.appendChild(cardYear);
        card.appendChild(cardImage);
        card.appendChild(cardBtn);

        /* Show card on website */
        artworkList.append(card);
    }
}
