import './Header.css'
import bamberg from '../assets/bamberg.png'

function Header(){
    return(
        <div className='header'>
            <img src={bamberg} className="logo" alt="bamberg logo" />
            <div className='nav-links'>
                <a href="https://bamberg-gestalten.de/unterstuetzungsfonds-der-stadt-bamberg">Unterstützungsfonds der Stadt Bamberg</a>
                <a href="https://bamberg-gestalten.de/buergerversammlung">Bürgerversammlung</a>
                <a href="https://bamberg-gestalten.de/events">Veranstaltungen</a>
            </div>
            <a href="https://bamberg-gestalten.de/users/sign_in" className='button sign-in-button'>Anmelden</a>
        </div>
    )
}

export default Header;